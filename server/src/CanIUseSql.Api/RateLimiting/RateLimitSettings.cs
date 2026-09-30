namespace CanIUseSql.Api.RateLimiting;

/// <summary>Bound from the "RateLimit" configuration section.</summary>
public sealed class RateLimitSettings
{
    public const string Section = "RateLimit";
    public const string PolicyName = "per-ip";

    /// <summary>
    /// Requests per window per client IP. Generous: through Vercel the "client"
    /// is an edge server shared by many visitors (DECISIONS.md), and responses
    /// are cached for an hour, so real visitors send very few.
    /// </summary>
    public int PermitLimit { get; set; } = 300;

    public int WindowSeconds { get; set; } = 60;
}
