using System;
using System.IO;
using System.Text;

namespace Pocket;

// Stands in for System.Console inside the user's program, so the parts that the
// browser runtime does not support (ReadKey, Clear, colors, cursor) still work.
public static class Console
{
    public static TextWriter Out => System.Console.Out;
    public static TextWriter Error => System.Console.Error;
    public static TextReader In => System.Console.In;
    public static void SetOut(TextWriter w) => System.Console.SetOut(w);
    public static void SetError(TextWriter w) => System.Console.SetError(w);
    public static void SetIn(TextReader r) => System.Console.SetIn(r);
    public static Stream OpenStandardOutput() => System.Console.OpenStandardOutput();
    public static Stream OpenStandardInput() => System.Console.OpenStandardInput();
    public static Stream OpenStandardError() => System.Console.OpenStandardError();

    public static Encoding OutputEncoding { get => Encoding.UTF8; set { } }
    public static Encoding InputEncoding { get => Encoding.UTF8; set { } }
    public static bool IsInputRedirected => false;
    public static bool IsOutputRedirected => false;
    public static bool IsErrorRedirected => false;
    public static bool TreatControlCAsInput { get; set; }
    public static bool CapsLock => false;
    public static bool NumberLock => false;
#pragma warning disable CS0067
    public static event ConsoleCancelEventHandler CancelKeyPress;
#pragma warning restore CS0067

    public static string Title { get => Term.Title; set { Term.Guard(); Term.Title = value ?? ""; Term.Control("\x1b]0;" + Term.Title.Replace("\a", "") + "\a"); } }
    public static ConsoleColor ForegroundColor { get => Term.Fg; set => Term.SetColor(false, value); }
    public static ConsoleColor BackgroundColor { get => Term.Bg; set => Term.SetColor(true, value); }
    public static void ResetColor() => Term.ResetColor();
    public static void Clear() => Term.Clear();

    public static int CursorLeft { get => Term.Col; set => Term.SetCursor(value, Term.Row); }
    public static int CursorTop { get => Term.Row; set => Term.SetCursor(Term.Col, value); }
    public static void SetCursorPosition(int left, int top) => Term.SetCursor(left, top);
    public static (int Left, int Top) GetCursorPosition() => (Term.Col, Term.Row);
    public static bool CursorVisible { get => Term.CursorVisible; set { Term.Guard(); Term.CursorVisible = value; } }
    public static int CursorSize { get => 25; set { } }

    public static int WindowWidth { get => Term.Cols; set { } }
    public static int WindowHeight { get => Term.Rows; set { } }
    public static int BufferWidth { get => Term.Cols; set { } }
    public static int BufferHeight { get => 9001; set { } }
    public static int WindowLeft { get => 0; set { } }
    public static int WindowTop { get => 0; set { } }
    public static int LargestWindowWidth => Term.Cols;
    public static int LargestWindowHeight => Term.Rows;
    public static void SetWindowSize(int width, int height) { }
    public static void SetBufferSize(int width, int height) { }
    public static void SetWindowPosition(int left, int top) { }

    public static void Beep() { Term.Control("\a"); }
    public static void Beep(int frequency, int duration) { Term.Control("\a"); Term.Sleep(duration); }

    public static bool KeyAvailable => Term.KeyAvailable;
    public static ConsoleKeyInfo ReadKey() => Term.ReadKey(false);
    public static ConsoleKeyInfo ReadKey(bool intercept) => Term.ReadKey(intercept);
    public static string ReadLine() => System.Console.In.ReadLine();
    public static int Read() => System.Console.In.Read();

    public static void WriteLine() => Out.WriteLine();
    public static void WriteLine(string value) => Out.WriteLine(value);
    public static void WriteLine(object value) => Out.WriteLine(value);
    public static void WriteLine(char value) => Out.WriteLine(value);
    public static void WriteLine(char[] buffer) => Out.WriteLine(buffer);
    public static void WriteLine(char[] buffer, int index, int count) => Out.WriteLine(buffer, index, count);
    public static void WriteLine(bool value) => Out.WriteLine(value);
    public static void WriteLine(int value) => Out.WriteLine(value);
    public static void WriteLine(uint value) => Out.WriteLine(value);
    public static void WriteLine(long value) => Out.WriteLine(value);
    public static void WriteLine(ulong value) => Out.WriteLine(value);
    public static void WriteLine(float value) => Out.WriteLine(value);
    public static void WriteLine(double value) => Out.WriteLine(value);
    public static void WriteLine(decimal value) => Out.WriteLine(value);
    public static void WriteLine(string format, object arg0) => Out.WriteLine(format, arg0);
    public static void WriteLine(string format, object arg0, object arg1) => Out.WriteLine(format, arg0, arg1);
    public static void WriteLine(string format, object arg0, object arg1, object arg2) => Out.WriteLine(format, arg0, arg1, arg2);
    public static void WriteLine(string format, params object[] arg) => Out.WriteLine(format, arg ?? new object[] { null });

    public static void Write(string value) => Out.Write(value);
    public static void Write(object value) => Out.Write(value);
    public static void Write(char value) => Out.Write(value);
    public static void Write(char[] buffer) => Out.Write(buffer);
    public static void Write(char[] buffer, int index, int count) => Out.Write(buffer, index, count);
    public static void Write(bool value) => Out.Write(value);
    public static void Write(int value) => Out.Write(value);
    public static void Write(uint value) => Out.Write(value);
    public static void Write(long value) => Out.Write(value);
    public static void Write(ulong value) => Out.Write(value);
    public static void Write(float value) => Out.Write(value);
    public static void Write(double value) => Out.Write(value);
    public static void Write(decimal value) => Out.Write(value);
    public static void Write(string format, object arg0) => Out.Write(format, arg0);
    public static void Write(string format, object arg0, object arg1) => Out.Write(format, arg0, arg1);
    public static void Write(string format, object arg0, object arg1, object arg2) => Out.Write(format, arg0, arg1, arg2);
    public static void Write(string format, params object[] arg) => Out.Write(format, arg ?? new object[] { null });
}

// Thread.Sleep that does not replay old pauses when the program resumes after an input.
public static class Thread
{
    public static void Sleep(int millisecondsTimeout) => Term.Sleep(millisecondsTimeout);
    public static void Sleep(TimeSpan timeout) => Term.Sleep((int)timeout.TotalMilliseconds);
}

// Random that repeats the same sequence when the program resumes after an input.
public class Random : System.Random
{
    public Random() : base(Term.NextSeed()) { }
    public Random(int Seed) : base(Seed) { }
    public static new System.Random Shared => Term.Shared;
}
