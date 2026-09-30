// CanIUseSql.Api: read-only JSON API for the SQL compatibility data.
// Controllers with attribute routing under /api/v2. The front end reaches it
// through a Vercel rewrite, so browsers see it on the site's own origin.

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

var app = builder.Build();

app.MapControllers();

app.Run();

// Lets WebApplicationFactory<Program> in the test project find this entry point.
public partial class Program;
