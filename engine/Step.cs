using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;
using System.Text;

namespace Pocket;

// Records what the program does, statement by statement, so the page can
// replay it forwards and backwards.
public static class Step
{
    const int Max = 30000;

    public static bool Active;
    public static int LastLine;

    static StringBuilder steps = new();
    static Dictionary<string, int> ids = new();
    static List<string> table = new();
    static readonly Dictionary<string, string[]> nameCache = new();
    static int count;
    static string last;

    public static void Begin()
    {
        steps = new StringBuilder();
        ids = new Dictionary<string, int>();
        table = new List<string>();
        count = 0;
        last = null;
        LastLine = 0;
        Active = true;
    }

    static int Id(string s)
    {
        if (!ids.TryGetValue(s, out int id))
        {
            id = table.Count;
            table.Add(s);
            ids[s] = id;
        }
        return id;
    }

    public static bool At(int line, string where, string names, object[] values)
    {
        Term.Guard();
        if (!Active) return true;
        LastLine = line;
        if (count >= Max)
        {
            Term.HaltWith("steplimit");
            throw new OutputLimit();
        }
        var sb = new StringBuilder();
        sb.Append(line).Append(',').Append(Term.Emitted).Append(',').Append(Id(where));
        if (names.Length > 0)
        {
            if (!nameCache.TryGetValue(names, out string[] list)) nameCache[names] = list = names.Split(',');
            for (int i = 0; i < list.Length && i < values.Length; i++)
                sb.Append(',').Append(Id(list[i])).Append(',').Append(Id(Show(values[i], 0)));
        }
        string record = sb.ToString();
        if (record == last) return true;     // same line, nothing changed: not a new step
        last = record;
        if (count++ > 0) steps.Append(',');
        steps.Append('[').Append(record).Append(']');
        return true;
    }

    public static string Take()
    {
        var sb = new StringBuilder("{\"strings\":[");
        for (int i = 0; i < table.Count; i++)
        {
            if (i > 0) sb.Append(',');
            sb.Append(Host.Json(table[i]));
        }
        sb.Append("],\"steps\":[").Append(steps).Append("]}");
        steps = new StringBuilder();
        return sb.ToString();
    }

    static string Clip(string s, int max) => s.Length <= max ? s : s.Substring(0, max) + "…";

    static string Show(object v, int depth)
    {
        try
        {
            switch (v)
            {
                case null: return "null";
                case string s: return "\"" + Clip(s, 60).Replace("\n", "\\n") + "\"";
                case char c: return "'" + c + "'";
                case bool b: return b ? "true" : "false";
                case Enum e: return e.ToString();
                case ConsoleKeyInfo k: return "tecla " + k.Key;
                case System.Random: return "Random";
                case Delegate: return "(função)";
            }
            Type type = v.GetType();
            if (type.IsPrimitive || v is decimal) return v.ToString();
            if (v is Array array && array.Rank == 2)
            {
                var rows = new List<string>();
                int r = array.GetLength(0), c = array.GetLength(1);
                for (int i = 0; i < r && i < 6; i++)
                {
                    var cells = new List<string>();
                    for (int j = 0; j < c && j < 10; j++) cells.Add(Show(array.GetValue(i, j), depth + 1));
                    rows.Add("[" + string.Join(", ", cells) + (c > 10 ? ", …" : "") + "]");
                }
                return "[" + string.Join(", ", rows) + (r > 6 ? ", …" : "") + "]";
            }
            if (v is IDictionary map)
            {
                var parts = new List<string>();
                foreach (DictionaryEntry entry in map)
                {
                    if (parts.Count >= 8) { parts.Add("…"); break; }
                    parts.Add(Show(entry.Key, depth + 1) + ": " + Show(entry.Value, depth + 1));
                }
                return "{ " + string.Join(", ", parts) + " }" + (map.Count > 8 ? " (" + map.Count + " itens)" : "");
            }
            if (v is ICollection items)
            {
                if (depth > 1) return "[" + items.Count + " itens]";
                var parts = new List<string>();
                foreach (object item in items)
                {
                    if (parts.Count >= 12) { parts.Add("…"); break; }
                    parts.Add(Show(item, depth + 1));
                }
                return "[" + string.Join(", ", parts) + "]" + (items.Count > 12 ? " (" + items.Count + " itens)" : "");
            }
            if (Host.IsUserType(type) && !type.IsValueType || Host.IsUserType(type) && !type.IsEnum)
            {
                if (depth > 0) return type.Name;
                var parts = new List<string>();
                foreach (FieldInfo field in type.GetFields(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic))
                {
                    if (parts.Count >= 8) { parts.Add("…"); break; }
                    string name = field.Name;
                    if (name.StartsWith("<"))
                    {
                        int end = name.IndexOf('>');
                        if (end <= 1) continue;
                        name = name.Substring(1, end - 1);
                    }
                    parts.Add(name + " = " + Show(field.GetValue(v), depth + 1));
                }
                return type.Name + (parts.Count > 0 ? " { " + string.Join(", ", parts) + " }" : "");
            }
            string text = v.ToString() ?? "";
            return text == type.FullName || text == type.ToString() ? type.Name : Clip(text, 60);
        }
        catch (Exception)
        {
            return "?";
        }
    }
}
