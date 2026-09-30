using Microsoft.AspNetCore.Mvc;

namespace CanIUseSql.Api.Controllers;

/// <summary>
/// Liveness and readiness probe for Azure Container Apps.
/// </summary>
[ApiController]
[Route("api/v2/health")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "ok" });
}
