# CanIUseSql.Api container image. Build from the repo root, because the API
# ships a copy of the site's data.json:
#   docker build -f server/Dockerfile -t caniusesql-api .

# --- build: full SDK, discarded after publish ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first, from the project file alone, so the package layer is cached
# until the dependencies change.
COPY server/src/CanIUseSql.Api/CanIUseSql.Api.csproj server/src/CanIUseSql.Api/
RUN dotnet restore server/src/CanIUseSql.Api/CanIUseSql.Api.csproj

# Same relative layout as the repo: the .csproj links ../../../data.json.
COPY data.json .
COPY server/src/CanIUseSql.Api/ server/src/CanIUseSql.Api/
RUN dotnet publish server/src/CanIUseSql.Api/CanIUseSql.Api.csproj \
    --configuration Release --no-restore --output /app

# --- runtime: ASP.NET Core only, chiseled Ubuntu ---
# Chiseled: no shell, no package manager, and it runs as the non-root "app"
# user (UID 1654) by default. No ICU either, hence InvariantGlobalization.
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled AS runtime
WORKDIR /app
COPY --from=build /app .

# Set explicitly, though these are the image's defaults: listen on 8080
# (non-root can't bind below 1024) as the non-root user.
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID

ENTRYPOINT ["dotnet", "CanIUseSql.Api.dll"]
