using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Text;

namespace Pocket;

// Os arquivos do projeto e a compilação deles. A compilação é reaproveitada: quando só um arquivo muda,
// só ele é lido de novo, o que deixa as sugestões e os erros ao digitar rápidos.
public static partial class Host
{
    // O número da linha de um comando carrega também o arquivo: arquivo * FileStride + linha.
    internal const int FileStride = 1_000_000;

    sealed class UserFile
    {
        public string Name, Text;
        public SyntaxTree Tree;
    }

    static UserFile[] files = Array.Empty<UserFile>();
    static SyntaxTree preludeTree;
    static string preludeText;
    static CSharpCompilation compilation;
    static string workspaceKey;
    static int counter;

    static readonly CSharpParseOptions ParseOptions = new(LanguageVersion.Latest);

    const string Usings =
        "global using System;\n" +
        "global using System.IO;\n" +
        "global using System.Linq;\n" +
        "global using System.Collections.Generic;\n" +
        "global using System.Threading;\n" +
        "global using System.Threading.Tasks;\n";

    // Os arquivos chegam da página em um texto só: "nome\u0002código" separados por \u0001.
    static List<(string name, string text)> Unpack(string packed)
    {
        var list = new List<(string, string)>();
        foreach (string record in packed.Split('\u0001'))
        {
            int cut = record.IndexOf('\u0002');
            if (cut < 0) continue;
            list.Add((record.Substring(0, cut), record.Substring(cut + 1)));
        }
        if (list.Count == 0) list.Add(("Program.cs", ""));
        return list;
    }

    static bool OnlySleeps(IEnumerable<string> sources)
    {
        // O substituto de Thread só conhece Sleep; se o programa usa Thread de verdade, deixar o Thread real.
        foreach (string source in sources)
            foreach (Match m in Regex.Matches(source, @"\bThread\b(\s*\.\s*(\w+))?"))
                if (!m.Groups[2].Success || m.Groups[2].Value != "Sleep") return false;
        return true;
    }

    static string PreludeFor(IEnumerable<string> sources) =>
        Usings +
        "global using Console = Pocket.Console;\n" +
        "global using Random = Pocket.Random;\n" +
        (OnlySleeps(sources) ? "global using Thread = Pocket.Thread;\n" : "");

    static SyntaxTree Parse(string text, string name) =>
        CSharpSyntaxTree.ParseText(SourceText.From(text, Encoding.UTF8), ParseOptions, name);

    static CSharpCompilationOptions Options() =>
        new CSharpCompilationOptions(
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

    // Deixa a compilação igual aos arquivos recebidos.
    internal static void Update(string packed)
    {
        if (compilation != null && workspaceKey == packed) return;
        var list = Unpack(packed);
        var next = new UserFile[list.Count];
        for (int i = 0; i < next.Length; i++)
        {
            var (name, text) = list[i];
            var same = files.FirstOrDefault(f => f.Name == name && f.Text == text);
            next[i] = same ?? new UserFile { Name = name, Text = text, Tree = Parse(text, name) };
        }
        string prelude = PreludeFor(list.Select(f => f.text));

        bool sameShape = compilation != null && preludeTree != null && prelude == preludeText && files.Length == next.Length
            && files.Zip(next, (a, b) => a.Name == b.Name).All(x => x);
        if (sameShape)
        {
            var c = compilation;
            for (int i = 0; i < next.Length; i++)
                if (!ReferenceEquals(files[i].Tree, next[i].Tree)) c = c.ReplaceSyntaxTree(files[i].Tree, next[i].Tree);
            compilation = c;
        }
        else
        {
            if (prelude != preludeText || preludeTree == null) { preludeTree = Parse(prelude, "Pocket.Usings.cs"); preludeText = prelude; }
            var trees = new List<SyntaxTree> { preludeTree };
            trees.AddRange(next.Select(f => f.Tree));
            compilation = CSharpCompilation.Create("Programa" + (++counter), trees, refs, Options());
        }
        files = next;
        workspaceKey = packed;
    }

    // A compilação com cada comando anotando a sua linha.
    static CSharpCompilation BuildTrackedCompilation()
    {
        var c = compilation;
        for (int i = 0; i < files.Length; i++)
        {
            var root = (CSharpSyntaxNode)new LineMarker(i * FileStride).Visit(files[i].Tree.GetRoot());
            c = c.ReplaceSyntaxTree(files[i].Tree, CSharpSyntaxTree.Create(root, ParseOptions, files[i].Name, Encoding.UTF8));
        }
        return c;
    }

    static int FileIndexOf(SyntaxTree tree)
    {
        if (tree == null) return -1;
        for (int i = 0; i < files.Length; i++) if (files[i].Tree == tree) return i;
        return -1;
    }

    // Um erro ou aviso em JSON: arquivo, linha e coluna (a partir de 1) e onde termina.
    static void AppendDiagnostic(StringBuilder sb, Diagnostic d, bool withEnd)
    {
        var span = d.Location.GetLineSpan();
        int file = FileIndexOf(d.Location.SourceTree);
        bool mine = file >= 0;
        sb.Append("{\"id\":").Append(Json(d.Id))
          .Append(",\"severity\":").Append(Json(d.Severity == DiagnosticSeverity.Error ? "error" : "warning"))
          .Append(",\"message\":").Append(Json(d.GetMessage()))
          .Append(",\"file\":").Append(file)
          .Append(",\"line\":").Append(mine ? span.StartLinePosition.Line + 1 : 0)
          .Append(",\"col\":").Append(mine ? span.StartLinePosition.Character + 1 : 0);
        if (withEnd)
            sb.Append(",\"endLine\":").Append(mine ? span.EndLinePosition.Line + 1 : 0)
              .Append(",\"endCol\":").Append(mine ? span.EndLinePosition.Character + 1 : 0);
        sb.Append('}');
    }

    sealed class LineMarker : CSharpSyntaxRewriter
    {
        readonly int baseLine;
        public LineMarker(int baseLine) { this.baseLine = baseLine; }

        StatementSyntax Mark(SyntaxNode at)
        {
            int line = at.GetLocation().GetLineSpan().StartLinePosition.Line + 1 + baseLine;
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
}
