using CanIUseSql.Api.Catalog;
using CanIUseSql.Api.Filters;
using CanIUseSql.Api.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CanIUseSql.Api.Controllers;

/// <summary>
/// The search box's data: name -> { slug, description } for every command,
/// in data.json order. About a twentieth of GET /api/v2/commands.
/// Its own path, not /commands/index: "index" is a valid slug.
/// </summary>
[ApiController]
[Route("api/v2/command-index")]
[ServiceFilter<CatalogCacheFilter>]
[EnableRateLimiting(RateLimitSettings.PolicyName)]
public class CommandIndexController(CommandCatalog catalog) : ControllerBase
{
    [HttpGet]
    public ActionResult<IReadOnlyDictionary<string, CommandSummary>> Get() => Ok(catalog.Index);
}
