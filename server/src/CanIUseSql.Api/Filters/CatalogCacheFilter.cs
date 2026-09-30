using CanIUseSql.Api.Catalog;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Net.Http.Headers;

namespace CanIUseSql.Api.Filters;

/// <summary>
/// HTTP caching for responses built from the catalog. On a 200 it adds
/// Cache-Control (one hour) and an ETag for the data version; if the
/// request's If-None-Match already has that ETag, the body is dropped and the
/// response becomes 304 Not Modified. Errors (400, 404) get neither header.
///
/// Applied with [ServiceFilter], so the filter comes from DI and gets the
/// catalog through its constructor.
/// </summary>
public sealed class CatalogCacheFilter(CommandCatalog catalog) : IActionFilter
{
    public const int MaxAgeSeconds = 3600;

    // Weak (W/): the proxies in front (Vercel, Container Apps) may compress the
    // body, and a strong ETag promises byte-identical content.
    private readonly EntityTagHeaderValue _etag = new($"\"{catalog.Version}\"", isWeak: true);

    public void OnActionExecuting(ActionExecutingContext context) { }

    public void OnActionExecuted(ActionExecutedContext context)
    {
        if (context.Result is not OkObjectResult)
            return;

        var request = context.HttpContext.Request.GetTypedHeaders();
        var response = context.HttpContext.Response.GetTypedHeaders();
        response.ETag = _etag;
        response.CacheControl = new CacheControlHeaderValue { Public = true, MaxAge = TimeSpan.FromSeconds(MaxAgeSeconds) };

        // If-None-Match uses the weak comparison (RFC 9110 13.1.2).
        if (request.IfNoneMatch.Any(tag => tag.Equals(EntityTagHeaderValue.Any) || tag.Compare(_etag, useStrongComparison: false)))
            context.Result = new StatusCodeResult(StatusCodes.Status304NotModified);
    }
}
