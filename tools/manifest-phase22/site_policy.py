"""Site-specific Phase 23 authorization: never accepts a shared preview."""
from staging_gate import authorize, require

SITE_ID = "2422b681-751c-4d23-a2e4-8d6b8060ca6a"
HOST = "manifest-phase22-staging.netlify.app"
ORIGIN = "https://" + HOST + "/"

def authorize_dedicated(doc):
    origin = authorize(doc)
    require(doc.get("staging_site_id") == SITE_ID, "Unexpected Netlify project ID")
    require(doc.get("authorized_host") == HOST and origin == ORIGIN, "Unexpected staging hostname")
    require(doc.get("team_login_all_deploys_confirmed") is True, "Team login protection must be confirmed")
    return origin
