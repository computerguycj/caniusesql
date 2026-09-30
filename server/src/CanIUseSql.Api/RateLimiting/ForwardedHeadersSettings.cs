namespace CanIUseSql.Api.RateLimiting;

/// <summary>Bound from the "ForwardedHeaders" configuration section.</summary>
public sealed class ForwardedHeadersSettings
{
    public const string Section = "ForwardedHeaders";

    /// <summary>
    /// CIDR ranges of the proxy directly in front of the app (Container Apps'
    /// ingress). X-Forwarded-For is only read on connections from these.
    /// Empty means trust nobody, and the connection's own address is used.
    /// </summary>
    public string[] TrustedNetworks { get; set; } = [];
}
