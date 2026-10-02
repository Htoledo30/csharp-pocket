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

namespace Pocket;

// A ponte entre a página e o compilador. As partes ficam em arquivos separados:
//   Host.cs            referências, compilar e executar
//   Host.Workspace.cs  os arquivos do projeto e a compilação que é reaproveitada a cada mudança
//   Host.Language.cs   erros ao digitar, sugestões e ajuda dos parâmetros
//   Host.Fs.cs         os arquivos que o programa grava (File.WriteAllText) entre uma execução e outra
public static partial class Host
{
    // --- O que o motor chama na página (veja worker.js) ---
    [JSImport("out", "pocket")]
    internal static partial void JsOut(string s);

    [JSImport("need", "pocket")]
    internal static partial void JsNeed(string kind);

    // Console real: espera de verdade o que o usuário digita (só quando a página está "isolada" e há SharedArrayBuffer).
    [JSImport("read", "pocket")]
    internal static partial string JsRead(string kind);

    [JSImport("poll", "pocket")]
    internal static partial bool JsPoll();

    [JSImport("sleep", "pocket")]
    internal static partial bool JsSleep(int ms);

    [JSImport("aborted", "pocket")]
    internal static partial bool JsAborted();

    static readonly List<MetadataReference> refs = new();
    static byte[] asmBytes, trackedBytes, stepBytes;
    static string compiledKey, stepKey;
    static Assembly running;
    internal static bool IsUserType(Type t) => running != null && t.Assembly == running;

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
            // Os assemblies do .NET vêm em Webcil dentro de um módulo wasm: achar o conteúdo na seção de dados
            // e depois os metadados pelo cabeçalho CLI.
            int pos = 8, payload = -1;
            while (pos < image.Length)
            {
                int id = image[pos++];
                int size = (int)Leb(image, ref pos);
                if (id == 11)
                {
                    int p = pos;
                    Leb(image, ref p);                 // quantidade de segmentos
                    Leb(image, ref p);                 // segmento 0: passivo
                    int len0 = (int)Leb(image, ref p);
                    p += len0;
                    Leb(image, ref p);                 // segmento 1: passivo
                    Leb(image, ref p);                 // seu tamanho
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

    // ------------------------------------------------------------------ compilar

    [JSExport]
    internal static string Compile(string packed)
    {
        var sw = Stopwatch.StartNew();
        Update(packed);
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
            if (!first) sb.Append(',');
            first = false;
            AppendDiagnostic(sb, d, false);
        }
        if (result.Success)
        {
            try
            {
                for (int i = 0; i < files.Length; i++)
                {
                    foreach (var (line, col, text) in Tips.Find(compilation.GetSemanticModel(files[i].Tree), files[i].Tree.GetRoot()))
                    {
                        if (++shown > 46) break;
                        if (!first) sb.Append(',');
                        first = false;
                        sb.Append("{\"id\":\"DICA\",\"severity\":\"tip\",\"message\":").Append(Json(text))
                          .Append(",\"file\":").Append(i)
                          .Append(",\"line\":").Append(line).Append(",\"col\":").Append(col).Append('}');
                    }
                }
            }
            catch (Exception)
            {
            }
        }
        sb.Append("],\"ms\":").Append(sw.ElapsedMilliseconds).Append('}');

        asmBytes = result.Success ? pe.ToArray() : null;
        compiledKey = result.Success ? packed : null;
        trackedBytes = null;
        return sb.ToString();
    }

    [JSExport]
    internal static bool IsCompiled(string packed) => asmBytes != null && compiledKey == packed;

    // ------------------------------------------------------------------ executar

    static async Task Execute(byte[] image)
    {
        var context = new AssemblyLoadContext("run" + (++counter), isCollectible: false);
        Assembly asm = context.LoadFromStream(new MemoryStream(image));
        running = asm;
        MethodInfo entry = asm.EntryPoint ?? throw new InvalidOperationException("O programa não tem um método Main.");
        if (entry.Name == "<Main>")
        {
            // O compilador embrulha um Main assíncrono num Main comum: chamar direto o assíncrono.
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

    // A versão do programa que anota a linha de cada comando (para dizer onde um erro aconteceu).
    static byte[] BuildTracked()
    {
        try
        {
            var pe = new MemoryStream();
            return BuildTrackedCompilation().Emit(pe).Success ? pe.ToArray() : null;
        }
        catch (Exception)
        {
            return null;
        }
    }

    // inputs: o que já foi digitado (modo "reexecutar"); skip: quanto da saída já foi mostrado.
    // live = true: o programa espera de verdade pelo que o usuário digita (Atomics.wait na página).
    [JSExport]
    internal static async Task<string> Run(string inputs, int skip, int cols, int rows, int seed, bool live)
    {
        if (asmBytes == null) return "error:0:Nada compilado.";
        string[] queue = inputs.Length == 0 ? Array.Empty<string>() : inputs.Split('\u0001');
        Term.Reset(queue, skip, cols, rows, seed, false, live);
        var sw = Stopwatch.StartNew();
        Exception failure = null;

        if (live)
        {
            // Ao vivo não dá para rodar de novo só para descobrir a linha do erro: já roda a versão com as linhas anotadas.
            trackedBytes ??= BuildTracked();
            try { await Execute(trackedBytes ?? asmBytes); }
            catch (Exception ex) { failure = Unwrap(ex); }
            if (Term.Aborted) return "aborted:" + Term.Emitted;
            if (Term.Halted) return Term.NeedKind == "limit" ? "limit:" + Term.Emitted : "done:" + Term.Emitted;
            if (failure == null) return "done:" + Term.Emitted;
            return "error:" + Term.Line + ":" + Describe(failure);
        }

        try { await Execute(asmBytes); }
        catch (Exception ex) { failure = Unwrap(ex); }

        if (Term.Halted)
            return Term.NeedKind == "limit" ? "limit:" + Term.Emitted : "need:" + Term.NeedKind + ":" + Term.Emitted;
        if (failure == null) return "done:" + Term.Emitted;

        string text = Describe(failure);
        int line = 0;
        if (sw.ElapsedMilliseconds < 4000)
        {
            // Rodar de novo, em silêncio, com as mesmas entradas, numa versão que anota a linha em execução.
            // Assim sabemos onde o programa parou.
            try
            {
                trackedBytes ??= BuildTracked();
                if (trackedBytes != null)
                {
                    FsReset();
                    Term.Reset(queue, 0, cols, rows, seed, true, false);
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

    // ------------------------------------------------------------------ passo a passo

    static byte[] BuildSteps()
    {
        // Primeiro com as variáveis de cada linha; se essa versão não compilar, só com as linhas.
        foreach (bool withVariables in new[] { true, false })
        {
            try
            {
                var plain = compilation;
                var marked = new List<(SyntaxTree old, SyntaxTree tree)>();
                for (int i = 0; i < files.Length; i++)
                {
                    var tree = files[i].Tree;
                    var model = plain.GetSemanticModel(tree);
                    var root = (CSharpSyntaxNode)new StepMarker(model, withVariables, i * FileStride).Visit(tree.GetRoot());
                    marked.Add((tree, CSharpSyntaxTree.Create(root, (CSharpParseOptions)tree.Options, tree.FilePath, Encoding.UTF8)));
                }
                var next = plain;
                foreach (var (old, tree) in marked) next = next.ReplaceSyntaxTree(old, tree);
                var pe = new MemoryStream();
                if (next.Emit(pe).Success) return pe.ToArray();
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
        if (stepKey != compiledKey)
        {
            stepBytes = BuildSteps();
            stepKey = compiledKey;
        }
        if (stepBytes == null) return "nostep:";
        string[] queue = inputs.Length == 0 ? Array.Empty<string>() : inputs.Split('\u0001');
        Term.Reset(queue, 0, cols, rows, seed, false, false);
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
                // Corpos async e iteradores vivem num MoveNext gerado: mostrar o método de onde vieram.
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
