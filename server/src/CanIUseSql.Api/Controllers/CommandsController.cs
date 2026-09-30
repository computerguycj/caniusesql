using System.ComponentModel.DataAnnotations;
using CanIUseSql.Api.Catalog;
using CanIUseSql.Api.Filters;
using CanIUseSql.Api.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CanIUseSql.Api.Controllers;

/// <summary>The SQL command data: all of it, or one command by slug.</summary>
[ApiController]
[Route("api/v2/commands")]
[ServiceFilter<CatalogCacheFilter>]
[EnableRateLimiting(RateLimitSettings.PolicyName)]
public class CommandsController(CommandCatalog catalog) : ControllerBase
{
    /// <summary>Same shape and content as data.json: name -> command.</summary>
    [HttpGet]
    public ActionResult<IReadOnlyDictionary<string, Command>> GetAll() => Ok(catalog.All);

    /// <summary>
    /// One command, with its name. A slug that isn't in the site's format is
    /// a 400 from [ApiController]'s automatic validation, before this runs.
    /// </summary>
    [HttpGet("{slug}")]
    public ActionResult<NamedCommand> GetBySlug(
        [FromRoute]
        [StringLength(CommandCatalog.SlugMaxLength)]
        [RegularExpression(CommandCatalog.SlugPattern)]
        string slug)
    {
        if (catalog.TryGet(slug, out var command))
            return Ok(command);

        return Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "Command not found",
            detail: $"No SQL command has the slug '{slug}'.");
    }
}
