using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CanIUseSql.Api.Tests;

// WebApplicationFactory boots the real app in memory (same Program.cs, same
// routing and middleware) and hands out an HttpClient wired to it.
public class HealthTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task Health_returns_ok_as_json()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/v2/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>(TestContext.Current.CancellationToken);
        Assert.Equal("ok", body?["status"]);
    }

    [Fact]
    public async Task Unknown_route_is_404()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/v2/nope", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
