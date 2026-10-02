using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices.JavaScript;
using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Pocket;

// O que o editor pede ao compilador enquanto você digita: erros, sugestões e a ajuda dos parâmetros.
public static partial class Host
{
    const string Placeholder = "__pocket__";

    static bool IsIdent(char c) => char.IsLetterOrDigit(c) || c == '_';

    // ------------------------------------------------------------------ erros ao digitar

    [JSExport]
    internal static string Analyze(string packed)
    {
        var sw = Stopwatch.StartNew();
        Update(packed);
        var sb = new StringBuilder("{\"diagnostics\":[");
        bool first = true;
        int shown = 0;
        foreach (var d in compilation.GetDiagnostics()
                     .Where(d => d.Severity >= DiagnosticSeverity.Warning && d.Id != "CS5001" && FileIndexOf(d.Location.SourceTree) >= 0)
                     .OrderByDescending(d => d.Severity)
                     .ThenBy(d => d.Location.SourceSpan.Start))
        {
            if (++shown > 40) break;
            if (!first) sb.Append(',');
            first = false;
            var one = new StringBuilder();
            AppendDiagnostic(one, d, true);
            one.Length--;                      // tira o "}" para acrescentar as sugestões de nome
            var names = d.Severity == DiagnosticSeverity.Error ? Candidates(d) : null;
            if (names != null && names.Count > 0) one.Append(",\"names\":[").Append(string.Join(",", names.Select(Json))).Append(']');
            one.Append('}');
            sb.Append(one);
        }
        sb.Append("],\"ms\":").Append(sw.ElapsedMilliseconds).Append('}');
        return sb.ToString();
    }

    // "Você quis dizer": nomes parecidos com o que foi digitado errado.
    static List<string> Candidates(Diagnostic d)
    {
        if (d.Id != "CS0103" && d.Id != "CS1061" && d.Id != "CS0117" && d.Id != "CS0246") return null;
        try
        {
            var tree = d.Location.SourceTree;
            var model = compilation.GetSemanticModel(tree);
            var span = d.Location.SourceSpan;
            string wrong = tree.GetText().ToString(span);
            if (wrong.Length == 0 || !wrong.All(IsIdent)) return null;
            var node = tree.GetRoot().FindNode(span, getInnermostNodeForTie: true);
            IEnumerable<ISymbol> pool;
            if (d.Id == "CS1061" || d.Id == "CS0117")
            {
                var access = node.AncestorsAndSelf().OfType<MemberAccessExpressionSyntax>().FirstOrDefault();
                if (access == null) return null;
                var (container, staticOnly) = ContainerOf(model, access.Expression);
                if (container == null) return null;
                pool = MembersOf(model, span.Start, container, staticOnly);
            }
            else pool = model.LookupSymbols(span.Start);

            var names = pool.Where(Offerable).Select(s => s.Name).Distinct().Where(n => n != Placeholder).ToList();
            int limit = Math.Max(1, wrong.Length / 4);
            return names
                .Select(n => (name: n, dist: n.Equals(wrong, StringComparison.OrdinalIgnoreCase) ? 0 : Distance(n.ToLowerInvariant(), wrong.ToLowerInvariant())))
                .Where(x => x.dist <= limit)
                .OrderBy(x => x.dist).ThenBy(x => Math.Abs(x.name.Length - wrong.Length)).ThenBy(x => x.name, StringComparer.Ordinal)
                .Take(3).Select(x => x.name).ToList();
        }
        catch (Exception)
        {
            return null;
        }
    }

    // Distância de edição (inserir, apagar, trocar e inverter letras vizinhas).
    static int Distance(string a, string b)
    {
        var d = new int[a.Length + 1, b.Length + 1];
        for (int i = 0; i <= a.Length; i++) d[i, 0] = i;
        for (int j = 0; j <= b.Length; j++) d[0, j] = j;
        for (int i = 1; i <= a.Length; i++)
            for (int j = 1; j <= b.Length; j++)
            {
                int cost = a[i - 1] == b[j - 1] ? 0 : 1;
                d[i, j] = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1), d[i - 1, j - 1] + cost);
                if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1]) d[i, j] = Math.Min(d[i, j], d[i - 2, j - 2] + 1);
            }
        return d[a.Length, b.Length];
    }

    // ------------------------------------------------------------------ sugestões

    sealed class Item
    {
        public string Label, Insert, Detail, Kind;
        public int Rank;
    }

    static string Kind(ISymbol s) => s switch
    {
        IMethodSymbol => "m",
        IPropertySymbol => "p",
        IFieldSymbol f => f.IsConst ? "k" : "f",
        IEventSymbol => "ev",
        ILocalSymbol or IParameterSymbol or IRangeVariableSymbol => "v",
        INamespaceSymbol => "n",
        ITypeParameterSymbol => "t",
        INamedTypeSymbol t => t.TypeKind switch { TypeKind.Struct => "s", TypeKind.Enum => "e", TypeKind.Interface => "i", TypeKind.Delegate => "d", _ => "c" },
        _ => "x",
    };

    static string KindName(INamedTypeSymbol t) => t.TypeKind switch
    {
        TypeKind.Struct => "estrutura", TypeKind.Enum => "enum", TypeKind.Interface => "interface", TypeKind.Delegate => "delegate", _ => "classe",
    };

    static readonly SymbolDisplayFormat Short = SymbolDisplayFormat.MinimallyQualifiedFormat;

    // Vale a pena mostrar esse símbolo?
    static bool Offerable(ISymbol s)
    {
        if (s.IsImplicitlyDeclared && s is not IParameterSymbol) return false;
        if (string.IsNullOrEmpty(s.Name) || s.Name.StartsWith("<") || s.Name == Placeholder) return false;
        switch (s)
        {
            case IMethodSymbol m:
                return m.MethodKind is MethodKind.Ordinary or MethodKind.LocalFunction or MethodKind.ReducedExtension;
            case IPropertySymbol p:
                return !p.IsIndexer;
            case IFieldSymbol f:
                return !f.IsImplicitlyDeclared;
            case INamedTypeSymbol t:
                return t.CanBeReferencedByName && !t.IsImplicitlyDeclared;
            case ILocalSymbol or IParameterSymbol or IEventSymbol or INamespaceSymbol or ITypeParameterSymbol or IRangeVariableSymbol:
                return true;
        }
        return false;
    }

    // De que "coisa" o código antes do ponto fala: um tipo (só membros static) ou um valor (membros de instância)?
    static (INamespaceOrTypeSymbol container, bool staticOnly) ContainerOf(SemanticModel model, ExpressionSyntax expression)
    {
        var symbol = model.GetSymbolInfo(expression).Symbol;
        if (symbol is INamespaceSymbol ns) return (ns, false);
        if (symbol is ITypeSymbol type && symbol is not ITypeParameterSymbol) return (type, true);
        var t = model.GetTypeInfo(expression).Type;
        if (t == null && symbol is ILocalSymbol l) t = l.Type;
        if (t == null || t.TypeKind == TypeKind.Error) return (null, false);
        return (t, false);
    }

    static IEnumerable<ISymbol> MembersOf(SemanticModel model, int position, INamespaceOrTypeSymbol container, bool staticOnly)
    {
        foreach (var s in model.LookupSymbols(position, container, includeReducedExtensionMethods: true))
        {
            if (container is INamespaceSymbol) { yield return s; continue; }
            if (s is INamedTypeSymbol) { if (staticOnly) yield return s; continue; }
            bool isStatic = s.IsStatic && !(s is IMethodSymbol { MethodKind: MethodKind.ReducedExtension });
            if (staticOnly == isStatic || (staticOnly && s is IFieldSymbol { IsConst: true })) yield return s;
        }
    }

    static Item MakeItem(ISymbol s, bool statementContext, bool creating, int count)
    {
        string name = s.Name;
        var item = new Item { Label = name, Insert = name, Kind = Kind(s), Rank = 5 };
        switch (s)
        {
            case IMethodSymbol m:
                item.Detail = m.ReturnsVoid ? "void" : m.ReturnType.ToDisplayString(Short);
                if (count > 1) item.Detail += " (+" + (count - 1) + ")";
                bool noArgs = m.Parameters.Length == 0 && count == 1;
                item.Insert = name + (noArgs ? "()" : "(|)") + (m.ReturnsVoid && statementContext ? ";" : "");
                item.Rank = 2;
                break;
            case IPropertySymbol p:
                item.Detail = p.Type.ToDisplayString(Short);
                item.Rank = 1;
                break;
            case IFieldSymbol f:
                item.Detail = f.Type.ToDisplayString(Short);
                item.Rank = 1;
                break;
            case IEventSymbol e:
                item.Detail = e.Type.ToDisplayString(Short);
                item.Rank = 3;
                break;
            case ILocalSymbol l:
                item.Detail = l.Type.ToDisplayString(Short);
                item.Rank = 0;
                break;
            case IParameterSymbol pa:
                item.Detail = pa.Type.ToDisplayString(Short);
                item.Rank = 0;
                break;
            case INamedTypeSymbol t:
                item.Detail = KindName(t);
                item.Rank = 3;
                if (t.Arity > 0) item.Insert = name + (creating ? "<|>()" : "<|>");
                else if (creating) item.Insert = name + "(|)";
                break;
            case INamespaceSymbol:
                item.Detail = "namespace";
                item.Rank = 4;
                break;
            case ITypeParameterSymbol:
                item.Detail = "tipo";
                item.Rank = 3;
                break;
        }
        // Os métodos que vêm de extensões (Linq) ficam depois dos do próprio tipo, e os que todo objeto tem (ToString, GetType...) no fim.
        if (s is IMethodSymbol { MethodKind: MethodKind.ReducedExtension } or IMethodSymbol { IsExtensionMethod: true }) item.Rank = 6;
        if (s.ContainingType?.SpecialType == SpecialType.System_Object && s is IMethodSymbol) item.Rank = 9;
        return item;
    }

    // Devolve { "start": onde a palavra começa, "items": [ { l, i, d, k } ] }.
    [JSExport]
    internal static string Complete(string packed, int fileIndex, int pos)
    {
        var sw = Stopwatch.StartNew();
        Update(packed);
        if (fileIndex < 0 || fileIndex >= files.Length) return "{\"start\":0,\"items\":[]}";
        var uf = files[fileIndex];
        string text = uf.Text;
        pos = Math.Max(0, Math.Min(pos, text.Length));
        int ps = pos; while (ps > 0 && IsIdent(text[ps - 1])) ps--;
        int pe = pos; while (pe < text.Length && IsIdent(text[pe])) pe++;
        string prefix = text.Substring(ps, pos - ps);
        int dot = ps - 1; while (dot >= 0 && (text[dot] == ' ' || text[dot] == '\t')) dot--;
        bool afterDot = dot >= 0 && text[dot] == '.' && !(dot > 0 && text[dot - 1] == '.');

        // Troca a palavra que está sendo digitada por um nome fixo: assim o código sempre "fecha" e dá para perguntar o que vem depois.
        var tree = Parse(text.Substring(0, ps) + Placeholder + text.Substring(pe), uf.Name);
        var model = compilation.ReplaceSyntaxTree(uf.Tree, tree).GetSemanticModel(tree);
        var token = tree.GetRoot().FindToken(ps);
        var items = new List<Item>();
        if (token.Text == Placeholder && token.Parent != null)
        {
            var node = token.Parent;
            // O usuário está dando nome a uma variável ou parâmetro: nada a sugerir.
            if (node.Parent is VariableDeclaratorSyntax || node is ParameterSyntax || node.Parent is ParameterSyntax || node.Parent is ForEachStatementSyntax || node.Parent is SingleVariableDesignationSyntax)
                return "{\"start\":" + ps + ",\"items\":[]}";
            bool statement = node.Parent is MemberAccessExpressionSyntax { Parent: ExpressionStatementSyntax };
            if (afterDot)
            {
                ExpressionSyntax expression = node.Parent switch
                {
                    MemberAccessExpressionSyntax ma when ma.Name == node => ma.Expression,
                    QualifiedNameSyntax qn when qn.Right == node => qn.Left,
                    MemberBindingExpressionSyntax { Parent: InvocationExpressionSyntax or MemberAccessExpressionSyntax or ConditionalAccessExpressionSyntax } mb
                        => mb.Ancestors().OfType<ConditionalAccessExpressionSyntax>().FirstOrDefault()?.Expression,
                    _ => null,
                };
                if (expression != null)
                {
                    var (container, staticOnly) = ContainerOf(model, expression);
                    if (container != null)
                        AddGrouped(items, MembersOf(model, ps, container, staticOnly), prefix, statement, false);
                }
            }
            else if (prefix.Length > 0)
            {
                bool creating = node.Parent is ObjectCreationExpressionSyntax { Type: var t } && t == node;
                var all = model.LookupSymbols(ps).Where(s => creating ? s is INamedTypeSymbol { IsAbstract: false, IsStatic: false } : true);
                AddGrouped(items, all, prefix, false, creating);
            }
        }

        var ordered = items.OrderBy(i => i.Rank).ThenBy(i => i.Label, StringComparer.OrdinalIgnoreCase).Take(80).ToList();
        var sb = new StringBuilder("{\"start\":").Append(ps).Append(",\"items\":[");
        for (int i = 0; i < ordered.Count; i++)
        {
            var it = ordered[i];
            if (i > 0) sb.Append(',');
            sb.Append("{\"l\":").Append(Json(it.Label)).Append(",\"i\":").Append(Json(it.Insert)).Append(",\"d\":").Append(Json(it.Detail ?? "")).Append(",\"k\":").Append(Json(it.Kind)).Append('}');
        }
        return sb.Append("],\"ms\":").Append(sw.ElapsedMilliseconds).Append('}').ToString();
    }

    static void AddGrouped(List<Item> items, IEnumerable<ISymbol> symbols, string prefix, bool statement, bool creating)
    {
        foreach (var group in symbols.Where(Offerable)
                     .Where(s => prefix.Length == 0 || s.Name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                     .Where(s => !(s.Name.Equals(prefix, StringComparison.Ordinal) && s is not IMethodSymbol && s is not INamedTypeSymbol))
                     .GroupBy(s => (s.Name, s is IMethodSymbol)))
        {
            // Os métodos com o mesmo nome (sobrecargas) viram uma entrada só; a primeira é a mais simples.
            var first = group.OrderBy(s => s is IMethodSymbol m ? m.Parameters.Length : 0).First();
            items.Add(MakeItem(first, statement, creating, group.Count()));
        }
    }

    // ------------------------------------------------------------------ ajuda dos parâmetros

    // Devolve { "active": índice do parâmetro, "best": qual forma mostrar, "overloads": [ { "ret", "name", "params": [..] } ] }
    [JSExport]
    internal static string Signature(string packed, int fileIndex, int pos)
    {
        Update(packed);
        if (fileIndex < 0 || fileIndex >= files.Length) return "{\"overloads\":[]}";
        var uf = files[fileIndex];
        pos = Math.Max(0, Math.Min(pos, uf.Text.Length));
        var model = compilation.GetSemanticModel(uf.Tree);
        var root = uf.Tree.GetRoot();
        var start = root.FindToken(Math.Max(0, pos - 1));

        // O par de parênteses mais interno que contém o cursor.
        ArgumentListSyntax list = null;
        for (var n = start.Parent; n != null; n = n.Parent)
        {
            if (n is ArgumentListSyntax al && pos >= al.OpenParenToken.Span.End && (al.CloseParenToken.IsMissing || pos <= al.CloseParenToken.SpanStart)
                && al.Parent is InvocationExpressionSyntax or ObjectCreationExpressionSyntax or ImplicitObjectCreationExpressionSyntax)
            { list = al; break; }
        }
        if (list == null) return "{\"overloads\":[]}";

        var call = list.Parent;
        var methods = new List<IMethodSymbol>();
        IMethodSymbol resolved = null;
        string name = "";
        try
        {
            var info = model.GetSymbolInfo(call);
            resolved = info.Symbol as IMethodSymbol;
            if (resolved != null) methods.Add(resolved);
            methods.AddRange(info.CandidateSymbols.OfType<IMethodSymbol>());
            if (call is InvocationExpressionSyntax inv)
            {
                methods.AddRange(model.GetMemberGroup(inv.Expression).OfType<IMethodSymbol>());
                name = inv.Expression switch { MemberAccessExpressionSyntax ma => ma.Name.Identifier.Text, IdentifierNameSyntax id => id.Identifier.Text, _ => "" };
            }
            else
            {
                var type = model.GetTypeInfo(call).Type as INamedTypeSymbol;
                if (type != null) methods.AddRange(type.InstanceConstructors.Where(c => model.IsAccessible(call.SpanStart, c)));
                name = type?.Name ?? "";
            }
        }
        catch (Exception)
        {
            return "{\"overloads\":[]}";
        }
        var distinct = new List<IMethodSymbol>();
        foreach (var m in methods)
        {
            var shown = m.ReducedFrom != null ? m.ReducedFrom : m;
            if (!distinct.Any(x => SymbolEqualityComparer.Default.Equals(x.OriginalDefinition, m.OriginalDefinition))) distinct.Add(m);
        }
        if (distinct.Count == 0) return "{\"overloads\":[]}";
        // Das formas com o mesmo número de parâmetros, as com Span (mais técnicas) vão depois.
        distinct = distinct.OrderBy(m => m.Parameters.Length).ThenBy(m => m.Parameters.Any(p => p.Type.Name is "Span" or "ReadOnlySpan") ? 1 : 0).ToList();

        int active = list.Arguments.GetSeparators().Count(sep => sep.Span.End <= pos);
        int best = resolved != null ? distinct.FindIndex(m => SymbolEqualityComparer.Default.Equals(m.OriginalDefinition, resolved.OriginalDefinition)) : -1;
        if (best < 0) best = distinct.FindIndex(m => m.Parameters.Length > active || m.Parameters.LastOrDefault()?.IsParams == true);
        if (best < 0) best = 0;

        var sb = new StringBuilder("{\"name\":").Append(Json(name)).Append(",\"active\":").Append(active).Append(",\"best\":").Append(best).Append(",\"overloads\":[");
        for (int i = 0; i < distinct.Count; i++)
        {
            var m = distinct[i];
            if (i > 0) sb.Append(',');
            sb.Append("{\"ret\":").Append(Json(m.MethodKind == MethodKind.Constructor ? "" : m.ReturnsVoid ? "void" : m.ReturnType.ToDisplayString(Short)))
              .Append(",\"params\":[").Append(string.Join(",", m.Parameters.Select(p => Json(p.ToDisplayString(Short))))).Append("]}");
        }
        return sb.Append("]}").ToString();
    }
}
