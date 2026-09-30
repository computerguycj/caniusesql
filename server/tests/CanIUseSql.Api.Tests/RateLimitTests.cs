using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace CanIUseSql.Api.Tests;

// TestServer has no real connection, so a startup filter sets the connection's
// address from a test-only header. It runs before the app's own pipeline,
// exactly where a real TCP peer address would already be set.
public class RateLimitTests
{
    private const string Proxy = "10.0.0.5";      // inside the trusted network
    private const string Outsider = "203.0.113.9"; // not trusted
    private const int Limit = 3;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static WebApplicationFactory<Program> App() =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(b => b
            .UseSetting("RateLimit:PermitLimit", Limit.ToString())
            .UseSetting("RateLimit:WindowSeconds", "60")
            .UseSetting("ForwardedHeaders:TrustedNetworks:0", "10.0.0.0/8")
            .ConfigureTestServices(s => s.AddSingleton<IStartupFilter, PeerAddressFilter>()));

    private static Task<HttpResponseMessage> Get(HttpClient client, string peer, string? forwardedFor = null, string url = "/api/v2/commands/join")
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add(PeerAddressFilter.Header, peer);
        if (forwardedFor is not null)
            request.Headers.Add("X-Forwarded-For", forwardedFor);
        return client.SendAsync(request, Ct);
    }

    private static async Task Spend(HttpClient client, string peer, string? forwardedFor = null)
    {
        for (var i = 0; i < Limit; i++)
            Assert.Equal(HttpStatusCode.OK, (await Get(client, peer, forwardedFor)).StatusCode);
    }

    [Fact]
    public async Task Over_the_limit_is_a_429_problem_with_retry_after()
    {
        using var app = App();
        var client = app.CreateClient();
        await Spend(client, Outsider);

        var response = await Get(client, Outsider);

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.NotNull(response.Headers.RetryAfter?.Delta);
    }

    [Fact]
    public async Task Each_client_ip_has_its_own_bucket()
    {
        using var app = App();
        var client = app.CreateClient();
        await Spend(client, Proxy, "198.51.100.1");

        Assert.Equal(HttpStatusCode.OK, (await Get(client, Proxy, "198.51.100.2")).StatusCode);
    }

    [Fact]
    public async Task Only_the_rightmost_forwarded_entry_counts()
    {
        // Entries left of the proxy's own are whatever the caller wrote. Changing
        // them on every request must not buy a fresh bucket.
        using var app = App();
        var client = app.CreateClient();
        await Spend(client, Proxy, "1.1.1.1, 198.51.100.1");

        var response = await Get(client, Proxy, "8.8.8.8, 198.51.100.1");

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
    }

    [Fact]
    public async Task Forwarded_for_from_an_untrusted_peer_is_ignored()
    {
        using var app = App();
        var client = app.CreateClient();
        await Spend(client, Outsider, "198.51.100.1");

        var response = await Get(client, Outsider, "198.51.100.2");

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
    }

    [Fact]
    public async Task Command_index_shares_the_limit()
    {
        using var app = App();
        var client = app.CreateClient();
        await Spend(client, Outsider);

        var response = await Get(client, Outsider, url: "/api/v2/command-index");

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
    }

    [Fact]
    public async Task Health_is_not_limited()
    {
        using var app = App();
        var client = app.CreateClient();
        await Spend(client, Outsider);

        var response = await Get(client, Outsider, url: "/api/v2/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private sealed class PeerAddressFilter : IStartupFilter
    {
        public const string Header = "X-Test-Peer";

        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((HttpContext context, RequestDelegate nextMiddleware) =>
            {
                context.Connection.RemoteIpAddress = IPAddress.Parse(context.Request.Headers[Header].ToString());
                return nextMiddleware(context);
            });
            next(app);
        };
    }
}
