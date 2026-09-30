using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CanIUseSql.Api.Tests;

public class CachingTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private Task<HttpResponseMessage> Get(string url, string? ifNoneMatch = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (ifNoneMatch is not null)
            request.Headers.TryAddWithoutValidation("If-None-Match", ifNoneMatch);
        return factory.CreateClient().SendAsync(request, Ct);
    }

    [Theory]
    [InlineData("/api/v2/commands")]
    [InlineData("/api/v2/commands/join")]
    [InlineData("/api/v2/command-index")]
    public async Task Success_is_cacheable_for_an_hour_with_a_weak_etag(string url)
    {
        var response = await Get(url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.Public);
        Assert.Equal(TimeSpan.FromHours(1), response.Headers.CacheControl?.MaxAge);
        Assert.True(response.Headers.ETag?.IsWeak);
    }

    [Fact]
    public async Task Every_endpoint_shares_the_data_version_etag()
    {
        var all = await Get("/api/v2/commands");
        var one = await Get("/api/v2/commands/join");
        var index = await Get("/api/v2/command-index");

        Assert.Equal(all.Headers.ETag, one.Headers.ETag);
        Assert.Equal(all.Headers.ETag, index.Headers.ETag);
    }

    [Theory]
    [InlineData("{0}")]
    [InlineData("\"other\", {0}")]
    [InlineData("*")]
    public async Task Matching_if_none_match_is_a_304_with_no_body(string header)
    {
        var etag = (await Get("/api/v2/commands")).Headers.ETag!.ToString();

        var response = await Get("/api/v2/commands", string.Format(header, etag));

        Assert.Equal(HttpStatusCode.NotModified, response.StatusCode);
        Assert.Equal(etag, response.Headers.ETag?.ToString());
        Assert.Equal(TimeSpan.FromHours(1), response.Headers.CacheControl?.MaxAge);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync(Ct));
    }

    [Fact]
    public async Task Strong_form_of_the_etag_also_matches()
    {
        // Weak comparison: a client or proxy that dropped the W/ still matches.
        var etag = (await Get("/api/v2/commands")).Headers.ETag!;

        var response = await Get("/api/v2/commands", etag.Tag);

        Assert.Equal(HttpStatusCode.NotModified, response.StatusCode);
    }

    [Fact]
    public async Task Stale_etag_gets_the_full_response()
    {
        var response = await Get("/api/v2/commands", "W/\"stale\"");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotEmpty(await response.Content.ReadAsByteArrayAsync(Ct));
    }

    [Theory]
    [InlineData("/api/v2/commands/no-such-command")]
    [InlineData("/api/v2/commands/JOIN")]
    public async Task Errors_are_not_cached_and_have_no_etag(string url)
    {
        var response = await Get(url, "*");

        Assert.NotEqual(HttpStatusCode.NotModified, response.StatusCode);
        Assert.Null(response.Headers.ETag);
        Assert.Null(response.Headers.CacheControl);
    }

    [Fact]
    public async Task Health_is_never_cached()
    {
        var response = await Get("/api/v2/health");

        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.Null(response.Headers.ETag);
    }
}
