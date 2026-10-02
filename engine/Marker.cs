using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Pocket;

// Rewrites the program so that every statement first reports its line and the
// variables that can be read at that point.
sealed class StepMarker : CSharpSyntaxRewriter
{
    readonly SemanticModel model;
    readonly bool withVariables;
    readonly int baseLine;   // arquivo * Host.FileStride: o número da linha também diz de qual arquivo ela é

    public StepMarker(SemanticModel model, bool withVariables, int baseLine = 0)
    {
        this.model = model;
        this.withVariables = withVariables;
        this.baseLine = baseLine;
    }

    int LineOf(SyntaxNode node) => node.GetLocation().GetLineSpan().StartLinePosition.Line + 1 + baseLine;
    int LineOf(SyntaxToken token) => token.GetLocation().GetLineSpan().StartLinePosition.Line + 1 + baseLine;

    static string Where(ISymbol symbol)
    {
        if (symbol is not IMethodSymbol m) return "";
        switch (m.MethodKind)
        {
            case MethodKind.AnonymousFunction: return "lambda";
            case MethodKind.LocalFunction: return m.Name;
            case MethodKind.Constructor: return m.ContainingType.Name + " (construtor)";
            case MethodKind.PropertyGet:
            case MethodKind.PropertySet: return m.ContainingType.Name + "." + (m.AssociatedSymbol?.Name ?? m.Name);
        }
        if (m.Name == "<Main>$" || (m.Name == "Main" && m.IsStatic)) return "";
        return m.ContainingType.Name + "." + m.Name;
    }

    void Consider(ISymbol symbol, ISymbol enclosing, int position, List<ISymbol> found)
    {
        ITypeSymbol type;
        if (symbol is IParameterSymbol p) { if (p.IsThis || (p.Name == "args" && enclosing?.Name == "Main")) return; type = p.Type; }
        else if (symbol is ILocalSymbol l) type = l.Type;
        else return;
        if (string.IsNullOrEmpty(symbol.Name) || symbol.Name == "_" || symbol.IsImplicitlyDeclared) return;
        if (type == null || type.IsRefLikeType || type.TypeKind == TypeKind.Pointer || type.TypeKind == TypeKind.FunctionPointer || type.TypeKind == TypeKind.Error) return;
        if (!SymbolEqualityComparer.Default.Equals(symbol.ContainingSymbol, enclosing)) return;
        if (found.Any(f => SymbolEqualityComparer.Default.Equals(f, symbol))) return;
        if (!model.LookupSymbols(position, name: symbol.Name).Any(s => SymbolEqualityComparer.Default.Equals(s, symbol))) return;
        found.Add(symbol);
    }

    ExpressionSyntax Call(int line, int position, StatementSyntax analyzed, bool onExit, IEnumerable<ISymbol> extra, int owner = -1)
    {
        ISymbol enclosing = null;
        try { enclosing = model.GetEnclosingSymbol(owner >= 0 ? owner : position); } catch (Exception) { }
        var found = new List<ISymbol>();
        bool self = false;
        if (withVariables && enclosing != null)
        {
            try
            {
                if (analyzed != null)
                {
                    var flow = model.AnalyzeDataFlow(analyzed);
                    if (flow != null && flow.Succeeded)
                        foreach (ISymbol symbol in onExit ? flow.DefinitelyAssignedOnExit : flow.DefinitelyAssignedOnEntry)
                            Consider(symbol, enclosing, position, found);
                }
                if (extra != null)
                    foreach (ISymbol symbol in extra)
                        if (symbol != null) Consider(symbol, enclosing, position, found);
            }
            catch (Exception)
            {
                found.Clear();
            }
            self = enclosing is IMethodSymbol m && !m.IsStatic && m.ContainingType?.TypeKind == TypeKind.Class
                && (m.MethodKind == MethodKind.Ordinary || m.MethodKind == MethodKind.PropertyGet || m.MethodKind == MethodKind.PropertySet);
        }
        var ordered = found.OrderBy(s => s.Locations.Length > 0 ? s.Locations[0].SourceSpan.Start : 0).Take(24).ToList();
        var names = new List<string>();
        var reads = new List<string>();
        if (self) { names.Add("this"); reads.Add("this"); }
        foreach (ISymbol symbol in ordered)
        {
            names.Add(symbol.Name);
            reads.Add(SyntaxFacts.GetKeywordKind(symbol.Name) != SyntaxKind.None || SyntaxFacts.GetContextualKeywordKind(symbol.Name) != SyntaxKind.None ? "@" + symbol.Name : symbol.Name);
        }
        string where = Where(enclosing).Replace("\\", "").Replace("\"", "");
        return SyntaxFactory.ParseExpression(
            "global::Pocket.Step.At(" + line + ", \"" + where + "\", \"" + string.Join(",", names) + "\", new object[] { " + string.Join(", ", reads) + " })");
    }

    StatementSyntax Mark(StatementSyntax statement)
        => SyntaxFactory.ExpressionStatement(Call(LineOf(statement), statement.SpanStart, statement, false, null));

    List<StatementSyntax> Marked(SyntaxList<StatementSyntax> statements)
    {
        var list = new List<StatementSyntax>();
        foreach (StatementSyntax statement in statements)
        {
            if (statement is not LocalFunctionStatementSyntax) list.Add(Mark(statement));
            list.Add((StatementSyntax)Visit(statement));
        }
        return list;
    }

    bool EndReachable(SyntaxList<StatementSyntax> statements)
    {
        try
        {
            var flow = model.AnalyzeControlFlow(statements.First(), statements.Last());
            return flow != null && flow.Succeeded && flow.EndPointIsReachable;
        }
        catch (Exception)
        {
            return false;
        }
    }

    public override SyntaxNode VisitBlock(BlockSyntax node)
    {
        var list = Marked(node.Statements);
        // At the closing brace of a method: show what the last line left behind.
        bool body = node.Parent is BaseMethodDeclarationSyntax || node.Parent is LocalFunctionStatementSyntax;
        if (body && node.Statements.Count > 0 && EndReachable(node.Statements))
            list.Add(SyntaxFactory.ExpressionStatement(Call(LineOf(node.CloseBraceToken), node.Statements.Last().SpanStart, node.Statements.Last(), true, null)));
        return node.WithStatements(SyntaxFactory.List(list));
    }

    public override SyntaxNode VisitSwitchSection(SwitchSectionSyntax node)
        => node.WithStatements(SyntaxFactory.List(Marked(node.Statements)));

    public override SyntaxNode VisitCompilationUnit(CompilationUnitSyntax node)
    {
        var members = new List<MemberDeclarationSyntax>();
        var globals = node.Members.OfType<GlobalStatementSyntax>().ToList();
        foreach (MemberDeclarationSyntax member in node.Members)
        {
            if (member is GlobalStatementSyntax global && global.Statement is not LocalFunctionStatementSyntax)
                members.Add(SyntaxFactory.GlobalStatement(Mark(global.Statement)));
            members.Add((MemberDeclarationSyntax)Visit(member));
            if (globals.Count > 0 && member == globals[globals.Count - 1])
            {
                bool reachable;
                try
                {
                    var flow = model.AnalyzeControlFlow(globals[0].Statement, globals[globals.Count - 1].Statement);
                    reachable = flow != null && flow.Succeeded && flow.EndPointIsReachable;
                }
                catch (Exception) { reachable = false; }
                // Line 0 = the program reached its end.
                if (reachable)
                    members.Add(SyntaxFactory.GlobalStatement(SyntaxFactory.ExpressionStatement(
                        Call(0, globals[globals.Count - 1].Statement.SpanStart, globals[globals.Count - 1].Statement, true, null))));
            }
        }
        return node.WithMembers(SyntaxFactory.List(members));
    }

    // A body without braces gets braces, so its statement is a step too.
    StatementSyntax Body(StatementSyntax original, StatementSyntax first)
    {
        var list = new List<StatementSyntax>();
        if (first != null) list.Add(first);
        if (original is BlockSyntax block)
        {
            list.AddRange(Marked(block.Statements));
            return block.WithStatements(SyntaxFactory.List(list));
        }
        if (original is not LocalFunctionStatementSyntax) list.Add(Mark(original));
        list.Add((StatementSyntax)Visit(original));
        return SyntaxFactory.Block(list);
    }

    bool IsConstant(ExpressionSyntax condition)
    {
        try { return condition == null || model.GetConstantValue(condition).HasValue; }
        catch (Exception) { return true; }
    }

    // "step ? (condition) : throw null" reports the step each time the condition
    // is tested, and leaves the compiler's flow analysis of the condition intact.
    ExpressionSyntax Tested(ExpressionSyntax step, ExpressionSyntax condition)
        => SyntaxFactory.ConditionalExpression(step,
            SyntaxFactory.ParenthesizedExpression((ExpressionSyntax)Visit(condition)),
            SyntaxFactory.ThrowExpression(SyntaxFactory.LiteralExpression(SyntaxKind.NullLiteralExpression)));

    public override SyntaxNode VisitIfStatement(IfStatementSyntax node)
    {
        var result = node.WithCondition((ExpressionSyntax)Visit(node.Condition)).WithStatement(Body(node.Statement, null));
        if (node.Else != null) result = result.WithElse(node.Else.WithStatement(Body(node.Else.Statement, null)));
        return result;
    }

    public override SyntaxNode VisitWhileStatement(WhileStatementSyntax node)
    {
        if (IsConstant(node.Condition))
        {
            var first = SyntaxFactory.ExpressionStatement(Call(LineOf(node), node.Statement.SpanStart, node, false, null));
            return node.WithStatement(Body(node.Statement, first));
        }
        var step = Call(LineOf(node), node.Condition.SpanStart, node, false, null);
        return node.WithCondition(Tested(step, node.Condition)).WithStatement(Body(node.Statement, null));
    }

    public override SyntaxNode VisitDoStatement(DoStatementSyntax node)
    {
        if (IsConstant(node.Condition)) return node.WithStatement(Body(node.Statement, null));
        var step = Call(LineOf(node.WhileKeyword), node.Condition.SpanStart, node, false, null);
        return node.WithCondition(Tested(step, node.Condition)).WithStatement(Body(node.Statement, null));
    }

    public override SyntaxNode VisitForStatement(ForStatementSyntax node)
    {
        var declared = new List<ISymbol>();
        if (node.Declaration != null)
            foreach (var variable in node.Declaration.Variables)
                if (variable.Initializer != null)
                    try { declared.Add(model.GetDeclaredSymbol(variable)); } catch (Exception) { }
        if (IsConstant(node.Condition))
        {
            var first = SyntaxFactory.ExpressionStatement(Call(LineOf(node), node.Statement.SpanStart, node, false, declared));
            return node.WithStatement(Body(node.Statement, first));
        }
        var step = Call(LineOf(node), node.Condition.SpanStart, node, false, declared);
        return node.WithCondition(Tested(step, node.Condition)).WithStatement(Body(node.Statement, null));
    }

    public override SyntaxNode VisitForEachStatement(ForEachStatementSyntax node)
    {
        var item = new List<ISymbol>();
        try { item.Add(model.GetDeclaredSymbol(node)); } catch (Exception) { }
        var first = SyntaxFactory.ExpressionStatement(Call(LineOf(node), node.Statement.SpanStart, node, false, item));
        return node.WithStatement(Body(node.Statement, first));
    }
}

// Things that compile but are almost always a slip, explained for a beginner.
static class Tips
{
    static bool IsLoop(SyntaxNode n) => n is WhileStatementSyntax || n is ForStatementSyntax || n is ForEachStatementSyntax || n is DoStatementSyntax;
    static bool IsBoundary(SyntaxNode n) => n is BaseMethodDeclarationSyntax || n is LocalFunctionStatementSyntax || n is AnonymousFunctionExpressionSyntax || n is TypeDeclarationSyntax;
    static string Squash(SyntaxNode n) => string.Concat(n.ToString().Where(c => !char.IsWhiteSpace(c)));
    static (int, int) At(SyntaxNode n)
    {
        var p = n.GetLocation().GetLineSpan().StartLinePosition;
        return (p.Line + 1, p.Character + 1);
    }
    static bool IsWholeNumber(ITypeSymbol t) => t != null && t.SpecialType is SpecialType.System_Int32 or SpecialType.System_Int64 or SpecialType.System_Int16
        or SpecialType.System_Byte or SpecialType.System_UInt32 or SpecialType.System_UInt64 or SpecialType.System_SByte or SpecialType.System_UInt16;
    static bool HasDecimals(ITypeSymbol t) => t != null && t.SpecialType is SpecialType.System_Double or SpecialType.System_Single or SpecialType.System_Decimal;

    public static List<(int line, int col, string text)> Find(SemanticModel model, SyntaxNode root)
    {
        var tips = new List<(int, int, string)>();
        void Add(SyntaxNode at, string text)
        {
            var (line, col) = At(at);
            if (tips.Count < 6 && !tips.Any(t => t.Item1 == line && t.Item3 == text)) tips.Add((line, col, text));
        }

        foreach (SyntaxNode node in root.DescendantNodes())
        {
            // new Random() created again on every turn of a loop
            if (node is BaseObjectCreationExpressionSyntax creation && model.GetTypeInfo(creation).Type?.Name == "Random")
            {
                for (SyntaxNode up = node.Parent; up != null && !IsBoundary(up); up = up.Parent)
                    if (IsLoop(up) && (up is not ForStatementSyntax f || !f.Initializers.Contains(node as ExpressionSyntax)))
                    {
                        Add(node, "Este new Random() está dentro de um laço, então um sorteador novo é criado a cada volta. Crie o Random uma vez só, antes do laço, e use o mesmo em todas as voltas.");
                        break;
                    }
            }

            // Next(1, 6) stops at 5
            if (node is InvocationExpressionSyntax call && call.Expression is MemberAccessExpressionSyntax access && access.Name.Identifier.Text == "Next"
                && call.ArgumentList.Arguments.Count == 2
                && model.GetConstantValue(call.ArgumentList.Arguments[0].Expression) is { HasValue: true, Value: int low }
                && model.GetConstantValue(call.ArgumentList.Arguments[1].Expression) is { HasValue: true, Value: int high }
                && low == 1 && (high == 4 || high == 6 || high == 8 || high == 10 || high == 12 || high == 20 || high == 100)
                && model.GetTypeInfo(access.Expression).Type?.Name == "Random")
            {
                Add(call, "Next(1, " + high + ") sorteia de 1 a " + (high - 1) + ": o segundo número não entra no sorteio. Para sortear de 1 a " + high + ", use Next(1, " + (high + 1) + ").");
            }

            if (node is WhileStatementSyntax loop)
            {
                // if (!x) as the first thing inside while (x)
                string condition = Squash(loop.Condition);
                if (loop.Statement is BlockSyntax block && block.Statements.FirstOrDefault() is IfStatementSyntax inner)
                {
                    string test = Squash(inner.Condition);
                    if (test == "!" + condition || test == "!(" + condition + ")" || test == condition + "==false")
                        Add(inner, "Este if nunca acontece: no começo de cada volta do while, " + loop.Condition + " é sempre verdadeiro (senão o laço já teria parado). O que deve rodar quando o laço termina vai depois do } do while.");
                }

                // nothing inside the loop changes what the condition looks at
                if (!model.GetConstantValue(loop.Condition).HasValue
                    && !loop.Condition.DescendantNodesAndSelf().Any(n => n is InvocationExpressionSyntax || n is AssignmentExpressionSyntax || n is AwaitExpressionSyntax
                        || n is PostfixUnaryExpressionSyntax || (n is PrefixUnaryExpressionSyntax pre && (pre.IsKind(SyntaxKind.PreIncrementExpression) || pre.IsKind(SyntaxKind.PreDecrementExpression)))))
                {
                    var watched = new List<ISymbol>();
                    foreach (var id in loop.Condition.DescendantNodesAndSelf().OfType<IdentifierNameSyntax>())
                    {
                        ISymbol symbol = model.GetSymbolInfo(id).Symbol;
                        if (symbol is ILocalSymbol { IsConst: false } || symbol is IParameterSymbol) { if (!watched.Contains(symbol, SymbolEqualityComparer.Default)) watched.Add(symbol); }
                        else if (symbol is IFieldSymbol || symbol is IPropertySymbol) { watched.Clear(); break; }
                    }
                    if (watched.Count > 0)
                    {
                        bool changes = false;
                        foreach (SyntaxNode inside in loop.Statement.DescendantNodesAndSelf())
                        {
                            if (inside is BreakStatementSyntax || inside is ReturnStatementSyntax || inside is ThrowStatementSyntax || inside is GotoStatementSyntax || inside is YieldStatementSyntax || inside is ThrowExpressionSyntax)
                            { changes = true; break; }
                            ExpressionSyntax target = inside switch
                            {
                                AssignmentExpressionSyntax a => a.Left,
                                PostfixUnaryExpressionSyntax post => post.Operand,
                                PrefixUnaryExpressionSyntax prefix when prefix.IsKind(SyntaxKind.PreIncrementExpression) || prefix.IsKind(SyntaxKind.PreDecrementExpression) => prefix.Operand,
                                ArgumentSyntax arg when !arg.RefKindKeyword.IsKind(SyntaxKind.None) => arg.Expression,
                                InvocationExpressionSyntax inv when inv.Expression is MemberAccessExpressionSyntax m => m.Expression,
                                DeclarationExpressionSyntax => null,
                                _ => null,
                            };
                            if (inside is InvocationExpressionSyntax anyCall && model.GetSymbolInfo(anyCall).Symbol is IMethodSymbol called && called.DeclaringSyntaxReferences.Length > 0)
                            { changes = true; break; }
                            while (target is ElementAccessExpressionSyntax element) target = element.Expression;
                            while (target is MemberAccessExpressionSyntax member) target = member.Expression;
                            if (target is IdentifierNameSyntax name && watched.Contains(model.GetSymbolInfo(name).Symbol, SymbolEqualityComparer.Default))
                            { changes = true; break; }
                        }
                        if (!changes)
                            Add(loop, "Este while pode nunca terminar: nada dentro dele muda " + string.Join(" nem ", watched.Select(w => w.Name)) + ", então a condição nunca passa a ser falsa.");
                    }
                }
            }

            // 7 / 2 kept in a double is still 3
            if (node is BinaryExpressionSyntax division && division.IsKind(SyntaxKind.DivideExpression))
            {
                if (IsWholeNumber(model.GetTypeInfo(division.Left).Type) && IsWholeNumber(model.GetTypeInfo(division.Right).Type))
                {
                    ExpressionSyntax outer = division;
                    while (outer.Parent is ParenthesizedExpressionSyntax paren) outer = paren;
                    if (HasDecimals(model.GetTypeInfo(outer).ConvertedType))
                        Add(division, "Divisão entre dois inteiros corta as casas decimais (7 / 2 dá 3, não 3,5). Para manter as casas, escreva um dos lados como decimal, por exemplo 2.0, ou coloque (double) na frente.");
                }
            }

            // for (...; i <= lista.Count; ...)
            if (node is ForStatementSyntax counted && counted.Condition is BinaryExpressionSyntax limit && limit.IsKind(SyntaxKind.LessThanOrEqualExpression)
                && limit.Right is MemberAccessExpressionSyntax size && (size.Name.Identifier.Text == "Length" || size.Name.Identifier.Text == "Count"))
            {
                Add(limit, "Com <= o laço vai uma posição além do fim: as posições vão de 0 até " + size.Name.Identifier.Text + " - 1. Troque <= por <.");
            }
        }
        return tips;
    }
}
