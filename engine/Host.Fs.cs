using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices.JavaScript;
using System.Text;
using System.Text.Json;

namespace Pocket;

// Os arquivos do programa (File.WriteAllText, File.ReadAllText...). O navegador não tem disco: durante a execução
// eles ficam na memória, numa pasta de trabalho. A página guarda uma cópia por programa e devolve antes de cada
// execução, então um save feito numa vez ainda está lá na próxima.
public static partial class Host
{
    const string WorkDir = "/work";
    const int MaxFiles = 200;
    const long MaxBytes = 4_000_000;
    static Dictionary<string, string> fsBase = new();

    static void Wipe()
    {
        Directory.CreateDirectory(WorkDir);
        foreach (string f in Directory.GetFiles(WorkDir, "*", SearchOption.AllDirectories)) File.Delete(f);
        foreach (string d in Directory.GetDirectories(WorkDir)) Directory.Delete(d, true);
    }

    static void WriteAll(Dictionary<string, string> snapshot)
    {
        foreach (var (path, base64) in snapshot)
        {
            string safe = path.Replace('\\', '/').TrimStart('/');
            if (safe.Contains("..")) continue;
            string full = Path.Combine(WorkDir, safe);
            Directory.CreateDirectory(Path.GetDirectoryName(full));
            File.WriteAllBytes(full, Convert.FromBase64String(base64));
        }
        Directory.SetCurrentDirectory(WorkDir);
    }

    // snapshot: { "pasta/arquivo.txt": "<conteúdo em base64>" }
    [JSExport]
    internal static void FsLoad(string json)
    {
        fsBase = new Dictionary<string, string>();
        try
        {
            if (!string.IsNullOrEmpty(json))
            {
                using var doc = JsonDocument.Parse(json);
                foreach (var p in doc.RootElement.EnumerateObject()) fsBase[p.Name] = p.Value.GetString() ?? "";
            }
            Wipe();
            WriteAll(fsBase);
        }
        catch (Exception)
        {
            // Sem arquivos é melhor do que sem programa.
        }
    }

    // Volta os arquivos ao estado do começo da execução (usado quando o programa é rodado de novo em silêncio).
    static void FsReset()
    {
        try { Wipe(); WriteAll(fsBase); }
        catch (Exception) { }
    }

    // O que o programa deixou na pasta de trabalho: { "changed": bool, "files": { caminho: base64 }, "truncated": bool }
    [JSExport]
    internal static string FsDump()
    {
        var sb = new StringBuilder("{\"files\":{");
        bool changed = false, truncated = false, first = true;
        long total = 0;
        int count = 0;
        var seen = new HashSet<string>();
        try
        {
            if (Directory.Exists(WorkDir))
            {
                foreach (string full in Directory.GetFiles(WorkDir, "*", SearchOption.AllDirectories))
                {
                    string rel = Path.GetRelativePath(WorkDir, full).Replace('\\', '/');
                    byte[] bytes = File.ReadAllBytes(full);
                    total += bytes.Length;
                    if (++count > MaxFiles || total > MaxBytes) { truncated = true; break; }
                    string b64 = Convert.ToBase64String(bytes);
                    seen.Add(rel);
                    if (!fsBase.TryGetValue(rel, out string before) || before != b64) changed = true;
                    if (!first) sb.Append(',');
                    first = false;
                    sb.Append(Json(rel)).Append(':').Append(Json(b64));
                }
            }
        }
        catch (Exception)
        {
            truncated = true;
        }
        foreach (string key in fsBase.Keys) if (!seen.Contains(key)) changed = true;
        sb.Append("},\"changed\":").Append(changed ? "true" : "false").Append(",\"truncated\":").Append(truncated ? "true" : "false").Append('}');
        return sb.ToString();
    }
}
