using System.Net;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CanIUseSql.Api.Tests;

public class CommandsTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    // The copy of data.json the app loaded (copied next to the test binaries).
    private static readonly JsonObject DataJson =
        JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "data.json")))!.AsObject();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<(HttpResponseMessage Response, JsonNode? Body)> Get(string url)
    {
        var response = await factory.CreateClient().GetAsync(url, Ct);
        var text = await response.Content.ReadAsStringAsync(Ct);
        return (response, text.Length == 0 ? null : JsonNode.Parse(text));
    }

    [Fact]
    public async Task All_commands_match_data_json()
    {
        var (response, body) = await Get("/api/v2/commands");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        var api = body!.AsObject();
        // Same names in the same order: the search lists matches in this order.
        Assert.Equal(DataJson.Select(p => p.Key), api.Select(p => p.Key));
        foreach (var (name, expected) in DataJson)
            AssertSameJson(expected, api[name], name);
    }

    [Fact]
    public async Task Html_sensitive_characters_are_escaped()
    {
        // JOIN's description contains an <a> tag.
        var response = await factory.CreateClient().GetAsync("/api/v2/commands/join", Ct);
        var raw = await response.Content.ReadAsStringAsync(Ct);

        Assert.Contains("\\u003Ca", raw);
        Assert.DoesNotContain('<', raw);
        Assert.DoesNotContain('>', raw);
    }

    [Fact]
    public async Task One_command_by_slug_is_the_entry_plus_its_name()
    {
        var (response, body) = await Get("/api/v2/commands/join");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var (name, entry) = DataJson.Single(p => (string?)p.Value!["slug"] == "join");
        var expected = entry!.DeepClone().AsObject();
        expected.Insert(0, "name", name);
        AssertSameJson(expected, body, "join");
    }

    [Fact]
    public async Task Unknown_slug_is_a_404_problem()
    {
        var (response, body) = await Get("/api/v2/commands/no-such-command");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(404, (int?)body!["status"]);
    }

    [Theory]
    [InlineData("JOIN")]
    [InlineData("join-")]
    [InlineData("-join")]
    [InlineData("a--b")]
    [InlineData("left_join")]
    [InlineData("%3Cscript%3E")]
    public async Task Malformed_slug_is_a_400_problem(string slug)
    {
        var (response, body) = await Get("/api/v2/commands/" + slug);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.NotNull(body!["errors"]?["slug"]);
    }

    [Fact]
    public async Task Too_long_slug_is_a_400_problem()
    {
        var (response, _) = await Get("/api/v2/commands/" + new string('a', 65));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Unknown_route_is_a_404_problem()
    {
        var (response, body) = await Get("/api/v2/nope");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(404, (int?)body!["status"]);
    }

    // JSON equality where key order doesn't matter and a missing key equals
    // an explicit null (data.json has both; the API always writes the key).
    private static void AssertSameJson(JsonNode? expected, JsonNode? actual, string path)
    {
        switch (expected)
        {
            case null:
                Assert.True(actual is null, $"{path}: expected null, got {actual?.ToJsonString()}");
                break;
            case JsonObject eo:
                var ao = Assert.IsType<JsonObject>(actual);
                var keys = eo.Select(p => p.Key).Union(ao.Select(p => p.Key));
                foreach (var key in keys)
                    AssertSameJson(eo[key], ao[key], $"{path}.{key}");
                break;
            case JsonArray ea:
                var aa = Assert.IsType<JsonArray>(actual);
                Assert.Equal(ea.Count, aa.Count);
                for (var i = 0; i < ea.Count; i++)
                    AssertSameJson(ea[i], aa[i], $"{path}[{i}]");
                break;
            default:
                Assert.True(JsonNode.DeepEquals(expected, actual),
                    $"{path}: expected {expected.ToJsonString()}, got {actual?.ToJsonString()}");
                break;
        }
    }
}
