using CanIUseSql.Api.Catalog;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CanIUseSql.Api.Tests;

// The catalog refuses bad data at startup instead of serving a partial copy.
public class CatalogTests
{
    private const string Dialect =
        """{ "supported": true, "notes": "n", "native": true, "workaround": null }""";

    private static string Entry(string slug, string extra = "") =>
        $$"""
        { "description": "d", "syntax": "s", "category": "c", "slug": "{{slug}}",
          "compatibility": { "mysql": {{Dialect}} }, "details": "x", "overview": "o"{{extra}} }
        """;

    [Fact]
    public void Valid_data_loads_in_order_with_missing_optionals_as_null()
    {
        var catalog = CommandCatalog.Parse($$"""{ "b": {{Entry("b")}}, "a": {{Entry("a")}} }""");

        Assert.Equal(["b", "a"], catalog.All.Keys);
        Assert.Null(catalog.All["b"].Compatibility["mysql"].Since);
        Assert.True(catalog.TryGet("a", out var a));
        Assert.Equal("a", a!.Name);
    }

    [Theory]
    [InlineData("unknown key", """{ "a": ENTRY_EXTRA }""")]
    [InlineData("missing required key", """{ "a": { "description": "d" } }""")]
    [InlineData("null where non-null", """{ "a": ENTRY_NULL }""")]
    [InlineData("duplicate slug", """{ "a": ENTRY_A, "b": ENTRY_A }""")]
    [InlineData("invalid slug", """{ "a": ENTRY_BAD }""")]
    [InlineData("not JSON", """{ "a": """)]
    public void Bad_data_is_rejected(string why, string template)
    {
        var json = template
            .Replace("ENTRY_EXTRA", Entry("a", """, "surprise": 1"""))
            .Replace("ENTRY_NULL", Entry("a").Replace("\"overview\": \"o\"", "\"overview\": null"))
            .Replace("ENTRY_A", Entry("a"))
            .Replace("ENTRY_BAD", Entry("Bad Slug"));

        var error = Record.Exception(() => CommandCatalog.Parse(json));

        Assert.True(error is not null, $"{why}: expected an exception");
    }

    [Fact]
    public void App_does_not_start_without_its_data()
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b =>
            b.UseSetting("Catalog:Path", Path.Combine(AppContext.BaseDirectory, "missing.json")));

        Assert.Throws<FileNotFoundException>(() => factory.CreateClient());
    }
}
