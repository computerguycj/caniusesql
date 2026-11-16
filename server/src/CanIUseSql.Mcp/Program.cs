// CanIUseSql.Mcp: an MCP server over stdio. A client (Claude Code, the MCP
// Inspector) starts this process and talks JSON-RPC to it on stdin/stdout.
// The tools are in CompatibilityTools.cs.
using CanIUseSql.Catalog;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var builder = Host.CreateApplicationBuilder(args);

// stdout carries the protocol, so nothing else may write to it. Send every
// log line to stderr instead.
builder.Logging.AddConsole(options => options.LogToStandardErrorThreshold = LogLevel.Trace);

// data.json is copied next to the app at build time (see the Catalog
// library's .csproj). Catalog:Path overrides it. Tools get the catalog as a
// parameter, injected from here.
builder.Services.AddSingleton(sp =>
{
    var path = sp.GetRequiredService<IConfiguration>()["Catalog:Path"]
        ?? Path.Combine(AppContext.BaseDirectory, "data.json");
    return CommandCatalog.Load(path);
});

builder.Services
    .AddMcpServer()
    .WithStdioServerTransport()
    .WithToolsFromAssembly();  // finds every [McpServerToolType] class in this project

var host = builder.Build();

// Fail fast: load the catalog now, not on the first tool call.
host.Services.GetRequiredService<CommandCatalog>();

await host.RunAsync();
