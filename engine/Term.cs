using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace Pocket;

public sealed class NeedInput : Exception
{
    public NeedInput() : base("aguardando entrada") { }
}

public sealed class OutputLimit : Exception
{
    public OutputLimit() : base("limite de saída") { }
}

public static class Term
{
    const long MaxOutput = 6_000_000;

    static Queue<string> inputs = new();
    static long skip, emitted;
    static int seed, seedCounter;
    static string pendingRead = "";
    static System.Random shared;

    public static bool Halted;
    public static bool Silent;
    public static int Line;
    public static string NeedKind = "";
    public static int Col, Row, Cols = 80, Rows = 24;
    public static ConsoleColor Fg = ConsoleColor.Gray, Bg = ConsoleColor.Black;
    public static string Title = "C# Pocket";
    public static bool CursorVisible = true;
    public static long Emitted => emitted;
    public static bool CatchingUp => inputs.Count > 0;

    public static readonly TermWriter Writer = new();
    public static readonly TermReader Reader = new();

    public static void Reset(string[] queued, long skipChars, int cols, int rows, int runSeed, bool silent)
    {
        Silent = silent;
        NoSleep = false;
        Line = 0;
        inputs = new Queue<string>(queued);
        skip = skipChars;
        emitted = 0;
        seed = runSeed;
        seedCounter = 0;
        pendingRead = "";
        shared = null;
        Halted = false;
        NeedKind = "";
        Col = 0; Row = 0;
        Cols = cols > 0 ? cols : 80;
        Rows = rows > 0 ? rows : 24;
        Fg = ConsoleColor.Gray; Bg = ConsoleColor.Black;
        Title = "C# Pocket";
        CursorVisible = true;
        System.Console.SetOut(Writer);
        System.Console.SetError(Writer);
        System.Console.SetIn(Reader);
    }

    public static int NextSeed() => unchecked(seed + 7919 * seedCounter++);
    public static System.Random Shared => shared ??= new System.Random(unchecked(seed ^ 0x5bd1e995));

    public static bool NoSleep;

    public static void HaltWith(string kind)
    {
        Halted = true;
        NeedKind = kind;
    }

    public static void Guard()
    {
        if (Halted) throw new NeedInput();
    }

    // Text written by the program: tracks the cursor, then goes to the screen.
    public static void Text(string s)
    {
        if (string.IsNullOrEmpty(s)) { Guard(); return; }
        Guard();
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (c == '\n') { Row++; Col = 0; }
            else if (c == '\r') Col = 0;
            else if (c == '\b') { if (Col > 0) Col--; }
            else if (c == '\t') Col = (Col / 8 + 1) * 8;
            else if (c == '\a') { }
            else if (c == '\x1b')
            {
                // skip a CSI sequence the program wrote by hand
                if (i + 1 < s.Length && s[i + 1] == '[')
                {
                    i += 2;
                    while (i < s.Length && !(s[i] >= '@' && s[i] <= '~')) i++;
                }
            }
            else if (!char.IsLowSurrogate(c)) Col++;
        }
        Send(s);
    }

    // Control sequences produced by the console API itself.
    public static void Control(string s)
    {
        Guard();
        Send(s);
    }

    static void Send(string s)
    {
        long before = emitted;
        emitted += s.Length;
        if (emitted > MaxOutput + skip)
        {
            Halted = true;
            NeedKind = "limit";
            throw new OutputLimit();
        }
        if (Silent || emitted <= skip) return;
        if (before >= skip) Host.JsOut(s);
        else Host.JsOut(s.Substring((int)(skip - before)));
    }

    static string Take(string kind)
    {
        Guard();
        if (inputs.Count == 0)
        {
            Halted = true;
            NeedKind = kind;
            if (!Silent) Host.JsNeed(kind);
            throw new NeedInput();
        }
        return inputs.Dequeue();
    }

    public static string ReadLine()
    {
        if (pendingRead.Length > 0)
        {
            string rest = pendingRead.TrimEnd('\n');
            pendingRead = "";
            return rest;
        }
        string item = Take("line");
        if (item == "E") return null;            // end of input (Ctrl+Z)
        string line = item.Length > 0 ? item.Substring(1) : "";
        if (item.Length > 0 && item[0] == 'K') line = KeyChar(line) is char k && k >= ' ' ? k.ToString() : "";
        Text(line + "\n");
        return line;
    }

    public static int Read()
    {
        if (pendingRead.Length == 0)
        {
            string item = Take("line");
            if (item == "E") return -1;
            string line = item.Length > 0 ? item.Substring(1) : "";
            Text(line + "\n");
            pendingRead = line + "\n";
        }
        char c = pendingRead[0];
        pendingRead = pendingRead.Substring(1);
        return c;
    }

    public static int Peek() => pendingRead.Length > 0 ? pendingRead[0] : -1;

    public static bool KeyAvailable
    {
        get { Guard(); return inputs.Count > 0 && inputs.Peek().StartsWith("K"); }
    }

    public static ConsoleKeyInfo ReadKey(bool intercept)
    {
        string item = Take("key");
        string name = item.Length > 0 ? item.Substring(1) : "";
        if (item.Length > 0 && item[0] == 'L') name = name.Length > 0 ? name.Substring(0, 1) : "Enter";
        var info = ToKeyInfo(name);
        if (!intercept)
        {
            if (info.Key == ConsoleKey.Enter) Text("\r");
            else if (info.KeyChar >= ' ') Text(info.KeyChar.ToString());
        }
        return info;
    }

    static char? KeyChar(string name) => ToKeyInfo(name).KeyChar;

    static ConsoleKeyInfo ToKeyInfo(string name)
    {
        if (name.Length == 1 || (name.Length == 2 && char.IsSurrogate(name[0])))
        {
            char c = name[0];
            ConsoleKey key;
            bool shift = false;
            if (c >= 'a' && c <= 'z') key = ConsoleKey.A + (c - 'a');
            else if (c >= 'A' && c <= 'Z') { key = ConsoleKey.A + (c - 'A'); shift = true; }
            else if (c >= '0' && c <= '9') key = ConsoleKey.D0 + (c - '0');
            else key = c switch
            {
                ' ' => ConsoleKey.Spacebar,
                '+' => ConsoleKey.OemPlus,
                '-' => ConsoleKey.OemMinus,
                ',' => ConsoleKey.OemComma,
                '.' => ConsoleKey.OemPeriod,
                '*' => ConsoleKey.Multiply,
                '/' => ConsoleKey.Divide,
                _ => 0,
            };
            return new ConsoleKeyInfo(c, key, shift, false, false);
        }
        return name switch
        {
            "Enter" => new ConsoleKeyInfo('\r', ConsoleKey.Enter, false, false, false),
            "Escape" => new ConsoleKeyInfo((char)27, ConsoleKey.Escape, false, false, false),
            "Backspace" => new ConsoleKeyInfo('\b', ConsoleKey.Backspace, false, false, false),
            "Tab" => new ConsoleKeyInfo('\t', ConsoleKey.Tab, false, false, false),
            "ArrowUp" => new ConsoleKeyInfo('\0', ConsoleKey.UpArrow, false, false, false),
            "ArrowDown" => new ConsoleKeyInfo('\0', ConsoleKey.DownArrow, false, false, false),
            "ArrowLeft" => new ConsoleKeyInfo('\0', ConsoleKey.LeftArrow, false, false, false),
            "ArrowRight" => new ConsoleKeyInfo('\0', ConsoleKey.RightArrow, false, false, false),
            "Delete" => new ConsoleKeyInfo('\0', ConsoleKey.Delete, false, false, false),
            "Home" => new ConsoleKeyInfo('\0', ConsoleKey.Home, false, false, false),
            "End" => new ConsoleKeyInfo('\0', ConsoleKey.End, false, false, false),
            "PageUp" => new ConsoleKeyInfo('\0', ConsoleKey.PageUp, false, false, false),
            "PageDown" => new ConsoleKeyInfo('\0', ConsoleKey.PageDown, false, false, false),
            "Insert" => new ConsoleKeyInfo('\0', ConsoleKey.Insert, false, false, false),
            _ when name.Length >= 2 && name[0] == 'F' && int.TryParse(name.AsSpan(1), out int f) && f >= 1 && f <= 12
                => new ConsoleKeyInfo('\0', ConsoleKey.F1 + (f - 1), false, false, false),
            _ => new ConsoleKeyInfo('\0', 0, false, false, false),
        };
    }

    public static void SetColor(bool background, ConsoleColor color)
    {
        int n = (int)color;
        if (n < 0 || n > 15) throw new ArgumentException("Cor de console inválida.");
        if (background) Bg = color; else Fg = color;
        Control("\x1b[" + n + (background ? "q" : "p"));
    }

    public static void ResetColor()
    {
        Fg = ConsoleColor.Gray; Bg = ConsoleColor.Black;
        Control("\x1b[0m");
    }

    public static void Clear()
    {
        Col = 0; Row = 0;
        Control("\x1b[2J");
    }

    public static void SetCursor(int left, int top)
    {
        if (left < 0) throw new ArgumentOutOfRangeException(nameof(left), left, "A posição do cursor não pode ser negativa.");
        if (top < 0) throw new ArgumentOutOfRangeException(nameof(top), top, "A posição do cursor não pode ser negativa.");
        Col = left; Row = top;
        Control("\x1b[" + (top + 1) + ";" + (left + 1) + "H");
    }

    public static void Sleep(int ms)
    {
        Guard();
        if (ms <= 0 || CatchingUp || Silent || NoSleep) return;
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try { System.Threading.Thread.Sleep(ms); }
        catch (PlatformNotSupportedException) { }
        while (sw.ElapsedMilliseconds < ms) { }
    }
}

public sealed class TermWriter : TextWriter
{
    public TermWriter() { CoreNewLine = new[] { '\n' }; }
    public override Encoding Encoding => Encoding.UTF8;
    public override void Write(char value) => Term.Text(value.ToString());
    public override void Write(string value) => Term.Text(value);
    public override void Write(char[] buffer, int index, int count) => Term.Text(new string(buffer, index, count));
    public override void Write(ReadOnlySpan<char> buffer) => Term.Text(new string(buffer));
    public override void WriteLine() => Term.Text("\n");
    public override void WriteLine(string value) => Term.Text(value + "\n");
}

public sealed class TermReader : TextReader
{
    public override string ReadLine() => Term.ReadLine();
    public override int Read() => Term.Read();
    public override int Peek() => Term.Peek();
}
