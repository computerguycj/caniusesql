# Deploying the API to Azure Container Apps

One-time setup. After it, every push to `main` that touches the API deploys
itself through `.github/workflows/api.yml`. Why each piece is set up this way
is in DECISIONS.md.

Commands are for bash: [Azure Cloud Shell](https://shell.azure.com) (Bash
mode) has the `az` CLI already signed in and needs no install. Each step says
how to check it worked. Steps 1 and 2 happen on GitHub; the rest in Azure.

## 1. Merge the API PR, let the image build

Merging to `main` runs the workflow: `test`, then `image` pushes
`ghcr.io/computerguycj/caniusesql-api` (tags `latest` and `sha-…`). `deploy`
is skipped because the Azure variables don't exist yet.

Check: Actions → API → the run on `main` has `test` and `image` green.

## 2. Make the image public

github.com/computerguycj → Packages → `caniusesql-api` → Package settings →
Danger Zone → Change visibility → Public.

Check (any machine, no sign-in): the manifest is readable anonymously.

```bash
TOKEN=$(curl -s "https://ghcr.io/token?scope=repository:computerguycj/caniusesql-api:pull" | sed 's/.*"token":"\([^"]*\)".*/\1/')
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.oci.image.index.v1+json" \
  https://ghcr.io/v2/computerguycj/caniusesql-api/manifests/latest
# 200 = public
```

## 3. Sign in, pick the subscription, register the providers

```bash
az account show --query "{name:name, id:id}" -o table   # the subscription in use
# If it's the wrong one: az account set --subscription "<name or id>"

az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait
```

Check: both `az provider show -n <namespace> --query registrationState -o tsv`
print `Registered`.

## 4. Names used below

Run this in the same shell as every later step (Cloud Shell forgets variables
when it times out; run it again if so).

```bash
RG=caniusesql-rg
LOC=eastus            # near Vercel's default region (Washington, D.C.)
ENV_NAME=caniusesql-env
APP=caniusesql-api
IMAGE=ghcr.io/computerguycj/caniusesql-api:latest
```

## 5. Resource group and Container Apps environment

```bash
az group create --name $RG --location $LOC
az containerapp env create --name $ENV_NAME --resource-group $RG --location $LOC
```

The environment also creates a Log Analytics workspace for the app's logs.
Log ingestion is billed per GB past a monthly free allowance; this app logs
little (warnings and up).

Check: `az containerapp env show -n $ENV_NAME -g $RG --query properties.provisioningState -o tsv`
prints `Succeeded`.

## 6. The container app

```bash
az containerapp create --name $APP --resource-group $RG --environment $ENV_NAME \
  --image $IMAGE \
  --ingress external --target-port 8080 \
  --min-replicas 0 --max-replicas 2 \
  --cpu 0.25 --memory 0.5Gi \
  --env-vars \
    ForwardedHeaders__TrustedNetworks__0=10.0.0.0/8 \
    ForwardedHeaders__TrustedNetworks__1=172.16.0.0/12 \
    ForwardedHeaders__TrustedNetworks__2=192.168.0.0/16 \
    ForwardedHeaders__TrustedNetworks__3=100.64.0.0/10

FQDN=$(az containerapp show -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv)
echo $FQDN
```

- `--min-replicas 0`: scale to zero when idle. The first request after idle
  waits for a cold start (a few seconds).
- `--max-replicas 2`: a ceiling on cost if something hammers it.
- 0.25 vCPU / 0.5 GiB is the smallest size and plenty for serving one cached file.
- `ForwardedHeaders__TrustedNetworks__N` is the `ForwardedHeaders:TrustedNetworks`
  array from appsettings.json (`__` stands for `:` in environment variables).
  Replicas have no public address, so the only thing that can connect to the
  app is the Container Apps ingress. Trusting the private and carrier-grade
  NAT ranges covers its address without knowing it exactly. Which range it
  actually uses is an inference; step 9 checks the result.

Check:

```bash
curl -s https://$FQDN/api/v2/health          # {"status":"ok"} (the first call may take a few seconds)
curl -si https://$FQDN/api/v2/commands/join | head -12   # 200, Cache-Control, ETag
```

**Send me `$FQDN`.** The Vercel rewrite (step 10) needs it.

## 7. Budget alert ($5)

In the portal (the CLI for budgets is awkward): Cost Management → Budgets →
Add. Scope: the subscription. Amount: 5, monthly. Alert conditions: Actual
50% and 100%, Forecasted 100%, to your email.

A budget alerts; it doesn't stop anything. The expected cost is $0 inside the
Container Apps monthly free grant.

Check: the budget is listed under Cost Management → Budgets.

## 8. Let GitHub Actions deploy (OpenID Connect)

Azure will trust tokens GitHub issues to this repo's `production` environment,
and only those. No password or key is stored in GitHub.

```bash
CLIENT_ID=$(az ad app create --display-name caniusesql-github-deploy --query appId -o tsv)
az ad sp create --id $CLIENT_ID

az ad app federated-credential create --id $CLIENT_ID --parameters '{
  "name": "github-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:computerguycj/caniusesql:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}'

# Contributor on this resource group only: it holds nothing but the API.
az role assignment create --assignee $CLIENT_ID --role Contributor \
  --scope $(az group show -n $RG --query id -o tsv)

# The values for GitHub:
echo "AZURE_CLIENT_ID=$CLIENT_ID"
echo "AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)"
echo "AZURE_RESOURCE_GROUP=$RG"
echo "AZURE_CONTAINER_APP=$APP"
```

On GitHub: the repo → Settings → Secrets and variables → Actions →
**Variables** tab (not Secrets; none of these is secret) → add each of the
five.

Optional: Settings → Environments → `production` (it appears after the first
deploy run, or create it now) → Required reviewers → you. Deploys then wait
for your click.

Check: Actions → API → Run workflow → `main`. All three jobs go green, and
`az containerapp revision list -n $APP -g $RG -o table` shows a new revision
whose image ends in `@sha256:…`.

## 9. Check the rate limit keys on the real client IP

From Cloud Shell, spend the limit (300 a minute) with a different fake
`X-Forwarded-For` on every request:

```bash
for i in $(seq 1 305); do
  curl -s -o /dev/null -w "%{http_code}\n" -H "X-Forwarded-For: 10.9.$((i/256)).$((i%256))" \
    https://$FQDN/api/v2/commands/join
done | sort | uniq -c
```

Expect about 300 × `200` then `429`s: the fake entries didn't buy fresh
buckets. Then, within the same minute, from your own machine:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<FQDN>/api/v2/commands/join
```

Expect `200`: your IP has its own bucket. A `429` here means the ingress's
address isn't in the trusted ranges and every caller shares one bucket; tell
me and we'll find its real range.

## 10. Vercel rewrite (Claude does this part)

With `$FQDN`, a rewrite in `vercel.json` sends `/api/v2/*` on the site to the
container app, and it's checked on a Vercel preview before merging.
