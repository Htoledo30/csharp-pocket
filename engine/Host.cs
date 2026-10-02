using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Reflection.Metadata;
using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Loader;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Emit;
using Microsoft.CodeAnalysis.Text;

namespace Pocket;

public static partial class Host
{
    [JSImport("out", "pocket")]
    internal static partial void JsOut(string s);

    [JSImport("need", "pocket")]
    internal static partial void JsNeed(string kind);

    static readonly List<MetadataReference> refs = new();
    static byte[] asmBytes, trackedBytes, stepBytes;
    static string stepSource;
    internal static bool IsUserType(Type t) => running != null && t.Assembly == running;
    static Assembly running;
    static string compiledSource;
    static int counter;

    const string Usings =
        "global using System;\n" +
        "global using System.IO;\n" +
        "global using System.Linq;\n" +
        "global using System.Collections.Generic;\n" +
        "global using System.Threading;\n" +
        "global using System.Threading.Tasks;\n";

    public static void Main() { }

    [JSExport]
    internal static unsafe bool AddReference(string name, byte[] image)
    {
        try
        {
            if (image.Length > 4 && image[0] == 'M' && image[1] == 'Z')
            {
                refs.Add(MetadataReference.CreateFromImage(image, filePath: name));
                return true;
            }
            // Framework assemblies ship as Webcil wrapped in a wasm module: find the
            // payload in the data section, then the metadata through the CLI header.
            int pos = 8, payload = -1;
            while (pos < image.Length)
            {
                int id = image[pos++];
                int size = (int)Leb(image, ref pos);
                if (id == 11)
                {
                    int p = pos;
                    Leb(image, ref p);                 // segment count
                    Leb(image, ref p);                 // segment 0: passive
                    int len0 = (int)Leb(image, ref p);
                    p += len0;
                    Leb(image, ref p);                 // segment 1: passive
                    Leb(image, ref p);                 // its length
                    payload = p;
                    break;
                }
                pos += size;
            }
            if (payload < 0 || image[payload] != 'W' || image[payload + 1] != 'b') return false;
            int sections = BitConverter.ToUInt16(image, payload + 8);
            uint cliRva = BitConverter.ToUInt32(image, payload + 12);
            int Offset(uint rva)
            {
                for (int i = 0; i < sections; i++)
                {
                    int h = payload + 28 + i * 16;
                    uint vsize = BitConverter.ToUInt32(image, h);
                    uint vaddr = BitConverter.ToUInt32(image, h + 4);
                    uint rawPtr = BitConverter.ToUInt32(image, h + 12);
                    if (rva >= vaddr && rva < vaddr + vsize) return payload + (int)(rva - vaddr + rawPtr);
                }
                throw new BadImageFormatException(name);
            }
            int cli = Offset(cliRva);
            uint mdRva = BitConverter.ToUInt32(image, cli + 8);
            int mdSize = (int)BitConverter.ToUInt32(image, cli + 12);
            int md = Offset(mdRva);
            IntPtr mem = System.Runtime.InteropServices.Marshal.AllocHGlobal(mdSize);
            System.Runtime.InteropServices.Marshal.Copy(image, md, mem, mdSize);
            var module = ModuleMetadata.CreateFromMetadata(mem, mdSize);
            refs.Add(AssemblyMetadata.Create(module).GetReference(display: name));
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    static uint Leb(byte[] data, ref int pos)
    {
        uint result = 0; int shift = 0;
        while (true)
        {
            byte b = data[pos++];
            result |= (uint)(b & 0x7f) << shift;
            if ((b & 0x80) == 0) return result;
            shift += 7;
        }
    }

    [JSExport]
    internal static string Init()
    {
        string roslyn = typeof(CSharpCompilation).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "";
        int plus = roslyn.IndexOf('+');
        if (plus > 0) roslyn = roslyn.Substring(0, plus);
        return "{\"runtime\":" + Json(Environment.Version.ToString()) +
               ",\"language\":" + Json(LanguageVersionFacts.ToDisplayString(LanguageVersionFacts.MapSpecifiedToEffectiveVersion(LanguageVersion.Latest))) +
               ",\"roslyn\":" + Json(roslyn) +
               ",\"refs\":" + refs.Count + "}";
    }

    static bool OnlySleeps(string source)
    {
        // The Thread stand-in only knows Sleep; leave real Thread usage alone.
        foreach (Match m in Regex.Matches(source, @"\bThread\b(\s*\.\s*(\w+))?"))
        {
            if (!m.Groups[2].Success || m.Groups[2].Value != "Sleep") return false;
        }
        return true;
    }

    static CSharpCompilation Build(string source, bool trackLines, out SyntaxTree userTree)
    {
        var parse = new CSharpParseOptions(LanguageVersion.Latest);
        string prelude = Usings +
            "global using Console = Pocket.Console;\n" +
            "global using Random = Pocket.Random;\n" +
            (OnlySleeps(source) ? "global using Thread = Pocket.Thread;\n" : "");
        userTree = CSharpSyntaxTree.ParseText(SourceText.From(source, Encoding.UTF8), parse, "Program.cs");
        if (trackLines)
            userTree = CSharpSyntaxTree.Create((CSharpSyntaxNode)new LineMarker().Visit(userTree.GetRoot()), parse, "Program.cs", Encoding.UTF8);
        var trees = new[]
        {
            CSharpSyntaxTree.ParseText(SourceText.From(prelude, Encoding.UTF8), parse, "Pocket.Usings.cs"),
            userTree,
        };
        var options = new CSharpCompilationOptions(
            OutputKind.ConsoleApplication,
            optimizationLevel: OptimizationLevel.Release,
            allowUnsafe: true,
            concurrentBuild: false)
            .WithSpecificDiagnosticOptions(new Dictionary<string, ReportDiagnostic>
            {
                ["CS1701"] = ReportDiagnostic.Suppress,
                ["CS1702"] = ReportDiagnostic.Suppress,
                ["CS8019"] = ReportDiagnostic.Suppress,
            });
        return CSharpCompilation.Create("Programa" + (++counter), trees, refs, options);
    }

    [JSExport]
    internal static string Compile(string source)
    {
        var sw = Stopwatch.StartNew();
        var compilation = Build(source, false, out SyntaxTree userTree);
        var pe = new MemoryStream();
        EmitResult result = compilation.Emit(pe);

        var sb = new StringBuilder();
        sb.Append("{\"ok\":").Append(result.Success ? "true" : "false").Append(",\"diagnostics\":[");
        bool first = true;
        int shown = 0;
        foreach (var d in result.Diagnostics
                     .Where(d => d.Severity >= DiagnosticSeverity.Warning)
                     .OrderByDescending(d => d.Severity)
                     .ThenBy(d => d.Location.SourceSpan.Start))
        {
            if (++shown > 40) break;
            var span = d.Location.GetLineSpan();
            bool mine = d.Location.SourceTree == userTree;
            if (!first) sb.Append(',');
            first = false;
            sb.Append("{\"id\":").Append(Json(d.Id))
              .Append(",\"severity\":").Append(Json(d.Severity == DiagnosticSeverity.Error ? "error" : "warning"))
              .Append(",\"message\":").Append(Json(d.GetMessage()))
              .Append(",\"line\":").Append(mine ? span.StartLinePosition.Line + 1 : 0)
              .Append(",\"col\":").Append(mine ? span.StartLinePosition.Character + 1 : 0)
              .Append('}');
        }
        if (result.Success)
        {
            try
            {
                foreach (var (line, col, text) in Tips.Find(compilation.GetSemanticModel(userTree), userTree.GetRoot()))
                {
                    if (++shown > 46) break;
                    if (!first) sb.Append(',');
                    first = false;
                    sb.Append("{\"id\":\"DICA\",\"severity\":\"tip\",\"message\":").Append(Json(text))
                      .Append(",\"line\":").Append(line).Append(",\"col\":").Append(col).Append('}');
                }
            }
            catch (Exception)
            {
            }
        }
        sb.Append("],\"ms\":").Append(sw.ElapsedMilliseconds).Append('}');

        asmBytes = result.Success ? pe.ToArray() : null;
        compiledSource = result.Success ? source : null;
        trackedBytes = null;
        return sb.ToString();
    }

    [JSExport]
    internal static bool IsCompiled(string source) => asmBytes != null && compiledSource == source;

    static async Task Execute(byte[] image)
    {
        var context = new AssemblyLoadContext("run" + (++counter), isCollectible: false);
        Assembly asm = context.LoadFromStream(new MemoryStream(image));
        running = asm;
        MethodInfo entry = asm.EntryPoint ?? throw new InvalidOperationException("O programa não tem um método Main.");
        if (entry.Name == "<Main>")
        {
            // The compiler wraps an async Main in a blocking stub; call the async one directly.
            const BindingFlags flags = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;
            MethodInfo real = entry.DeclaringType.GetMethods(flags)
                .FirstOrDefault(m => (m.Name == "Main" || m.Name == "<Main>$") && typeof(Task).IsAssignableFrom(m.ReturnType));
            if (real != null) entry = real;
        }
        object[] args = entry.GetParameters().Length == 0 ? null : new object[] { Array.Empty<string>() };
        object returned = entry.Invoke(null, args);
        if (returned is Task task) await task;
    }

    static Exception Unwrap(Exception ex)
    {
        while (ex is TargetInvocationException && ex.InnerException != null) ex = ex.InnerException;
        return ex;
    }

    [JSExport]
    internal static async Task<string> Run(string inputs, int skip, int cols, int rows, int seed)
    {
        if (asmBytes == null) return "error:0:Nada compilado.";
        string[] queue = inputs.Length == 0 ? Array.Empty<string>() : inputs.Split('\u0001');
        Term.Reset(queue, skip, cols, rows, seed, false);
        var sw = Stopwatch.StartNew();
        Exception failure = null;
        try { await Execute(asmBytes); }
        catch (Exception ex) { failure = Unwrap(ex); }

        if (Term.Halted)
            return Term.NeedKind == "limit" ? "limit:" + Term.Emitted : "need:" + Term.NeedKind + ":" + Term.Emitted;
        if (failure == null) return "done:" + Term.Emitted;

        string text = Describe(failure);
        int line = 0;
        if (sw.ElapsedMilliseconds < 4000)
        {
            // Run the same inputs again, silently, on a build that records the
            // line being executed. That tells us where the program stopped.
            try
            {
                if (trackedBytes == null)
                {
                    var pe = new MemoryStream();
                    if (Build(compiledSource, true, out _).Emit(pe).Success) trackedBytes = pe.ToArray();
                }
                if (trackedBytes != null)
                {
                    Term.Reset(queue, 0, cols, rows, seed, true);
                    Exception again = null;
                    try { await Execute(trackedBytes); }
                    catch (Exception ex) { again = Unwrap(ex); }
                    if (again != null && again.GetType() == failure.GetType() && !Term.Halted) line = Term.Line;
                }
            }
            catch (Exception)
            {
            }
        }
        return "error:" + line + ":" + text;
    }

    static byte[] BuildSteps(string source)
    {
        // First with the variables of each line; if that version does not compile, with the lines only.
        foreach (bool withVariables in new[] { true, false })
        {
            try
            {
                var plain = Build(source, false, out SyntaxTree tree);
                var model = plain.GetSemanticModel(tree);
                var root = (CSharpSyntaxNode)new StepMarker(model, withVariables).Visit(tree.GetRoot());
                var marked = CSharpSyntaxTree.Create(root, (CSharpParseOptions)tree.Options, "Program.cs", Encoding.UTF8);
                var pe = new MemoryStream();
                if (plain.ReplaceSyntaxTree(tree, marked).Emit(pe).Success) return pe.ToArray();
            }
            catch (Exception)
            {
            }
        }
        return null;
    }

    [JSExport]
    internal static async Task<string> Trace(string inputs, int cols, int rows, int seed)
    {
        if (asmBytes == null) return "error:0:Nada compilado.";
        if (stepSource != compiledSource)
        {
            stepBytes = BuildSteps(compiledSource);
            stepSource = compiledSource;
        }
        if (stepBytes == null) return "nostep:";
        string[] queue = inputs.Length == 0 ? Array.Empty<string>() : inputs.Split('\u0001');
        Term.Reset(queue, 0, cols, rows, seed, false);
        Term.NoSleep = true;
        Step.Begin();
        Exception failure = null;
        try { await Execute(stepBytes); }
        catch (Exception ex) { failure = Unwrap(ex); }
        finally { Step.Active = false; Term.NoSleep = false; }

        if (Term.Halted)
            return Term.NeedKind == "limit" || Term.NeedKind == "steplimit" ? Term.NeedKind + ":" + Term.Emitted : "need:" + Term.NeedKind + ":" + Term.Emitted;
        if (failure == null) return "done:" + Term.Emitted;
        return "error:" + Step.LastLine + ":" + Describe(failure);
    }

    [JSExport]
    internal static string TakeTrace() => Step.Take();

    static string Describe(Exception ex)
    {
        var sb = new StringBuilder();
        sb.Append(ex.GetType().FullName).Append(": ").Append(ex.Message);
        for (var inner = ex.InnerException; inner != null; inner = inner.InnerException)
            sb.Append("\n ---> ").Append(inner.GetType().FullName).Append(": ").Append(inner.Message);
        try
        {
            int shown = 0;
            string last = null;
            foreach (StackFrame frame in new StackTrace(ex, false).GetFrames())
            {
                MethodBase method = frame.GetMethod();
                if (method == null || method.Module.Assembly != running) continue;
                string owner = method.DeclaringType?.FullName ?? "";
                string name = method.Name;
                // Async and iterator bodies live in a generated MoveNext: show the method they came from.
                var machine = Regex.Match(owner, @"^(?<o>.*?)[+.]?<(?<n>[^+]+)>d(__\d+)?$");
                if (name == "MoveNext" && machine.Success) { owner = machine.Groups["o"].Value; name = machine.Groups["n"].Value; }
                var local = Regex.Match(name, @"g__(\w+)\|");
                if (local.Success) name = local.Groups[1].Value;
                else if (name.Contains("b__")) name = "(lambda)";
                else if (name == "<Main>$") name = "(código principal)";
                int closure = owner.IndexOf("+<", StringComparison.Ordinal);
                if (closure >= 0) owner = owner.Substring(0, closure);
                owner = owner.Replace('+', '.');
                string shownName = owner == "Program" && name.StartsWith("(") ? name : owner + "." + name;
                if (shownName == last) continue;
                last = shownName;
                if (++shown > 12) break;
                sb.Append("\n   em ").Append(shownName);
            }
        }
        catch (Exception)
        {
        }
        return sb.ToString();
    }

    sealed class LineMarker : CSharpSyntaxRewriter
    {
        static StatementSyntax Mark(SyntaxNode at)
        {
            int line = at.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
            return SyntaxFactory.ParseStatement("global::Pocket.Term.Line = " + line + ";");
        }

        IEnumerable<StatementSyntax> Marked(SyntaxList<StatementSyntax> statements)
        {
            foreach (StatementSyntax statement in statements)
            {
                if (statement is not LocalFunctionStatementSyntax) yield return Mark(statement);
                yield return (StatementSyntax)Visit(statement);
            }
        }

        public override SyntaxNode VisitBlock(BlockSyntax node)
            => node.WithStatements(SyntaxFactory.List(Marked(node.Statements).ToList()));

        public override SyntaxNode VisitSwitchSection(SwitchSectionSyntax node)
            => node.WithStatements(SyntaxFactory.List(Marked(node.Statements).ToList()));

        public override SyntaxNode VisitCompilationUnit(CompilationUnitSyntax node)
        {
            var members = new List<MemberDeclarationSyntax>();
            foreach (MemberDeclarationSyntax member in node.Members)
            {
                if (member is GlobalStatementSyntax global && global.Statement is not LocalFunctionStatementSyntax)
                    members.Add(SyntaxFactory.GlobalStatement(Mark(global)));
                members.Add((MemberDeclarationSyntax)Visit(member));
            }
            return node.WithMembers(SyntaxFactory.List(members));
        }
    }

    internal static string Json(string s)
    {
        var sb = new StringBuilder("\"");
        foreach (char c in s ?? "")
        {
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
                    else sb.Append(c);
                    break;
            }
        }
        return sb.Append('"').ToString();
    }
}
