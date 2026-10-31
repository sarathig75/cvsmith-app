"""Fixed word lists for the ATS score. Source of truth: docs/ATS_RULES.md (approved 2026-10-28).

Changes go through the review in that file (section 7), with a test (tests/test_ats_lists.py).
All terms are lower case; matching is by whole words.
"""
from typing import Dict, List, Set, Tuple

# 1. Action verbs (check A6). A bullet is strong when its first word is one of these, in any form
# (see ats.text.is_strong_verb).
ACTION_VERBS = (
    "accelerated achieved administered analysed architected automated built consolidated created cut "
    "defined delivered designed developed directed drove eliminated established expanded forecast "
    "generated grew implemented improved increased initiated introduced launched led managed migrated "
    "modernised negotiated optimised orchestrated owned piloted planned recruited redesigned reduced "
    "resolved restructured scaled secured simplified standardised streamlined supervised transformed "
    "trained validated"
    # added 2026-10-31 (user approved widening the list): common strong verbs the check missed
    " coordinated conducted prepared oversaw spearheaded mentored partnered executed facilitated evaluated"
    " presented reviewed maintained monitored organised wrote advised audited documented coached onboarded"
    " collaborated engineered produced processed tested deployed integrated configured reconciled assessed"
    " identified saved"
).split()

# Weak or filler openers: never strong, and never recorded as unmatched verbs.
WEAK_OPENERS = (
    "responsible assisted helped supported worked involved participated handled contributed familiar various"
).split()

# 2. Passive and filler phrases (check A8), counted anywhere in a bullet.
FILLER_PHRASES = (
    "responsible for", "assisted with", "assisted in", "helped with", "helped the team", "worked on",
    "involved in", "participated in", "in charge of", "duties included", "duties were", "tasked with",
    "was part of", "part of the team", "dealt with", "exposed to", "familiar with", "good knowledge of",
    "hard-working", "detail-oriented", "various", "etc.",
)

# 3. Alias list (checks B1, B2): canonical skill -> other forms that count as a match.
ALIASES: Dict[str, Tuple[str, ...]] = {
    "react": ("react.js", "reactjs"),
    "node.js": ("node", "nodejs"),
    "kubernetes": ("k8s",),
    "javascript": ("js",),
    "typescript": ("ts",),
    "postgresql": ("postgres",),
    "machine learning": ("ml",),
    "amazon web services": ("aws",),
    "google cloud": ("gcp", "google cloud platform"),
    "microsoft excel": ("excel", "ms excel"),
    "power bi": ("powerbi",),
    "ci/cd": ("continuous integration", "continuous delivery", "continuous deployment"),
    "stakeholder management": ("stakeholder engagement",),
    "human resources information system": ("hris",),
    "applicant tracking system": ("ats",),
    "six sigma": ("6 sigma", "lean six sigma"),
    "oee": ("overall equipment effectiveness",),
    "iso 9001": ("iso9001",),
    "preventive maintenance": ("pm schedule", "planned maintenance"),
    "gmp": ("good manufacturing practice",),
    "fmea": ("failure mode and effects analysis",),
    "ppap": ("production part approval process",),
    "iatf 16949": ("iatf16949",),
    "usfda": ("us fda", "fda"),
    "general trade": ("gt",),
    "modern trade": ("mt",),
}

# 4. Title ladders (check B5): family -> rungs, lowest to highest. A rung with "/" has equal alternatives.
LADDERS: Dict[str, Tuple[str, ...]] = {
    "Software engineering": ("junior engineer", "engineer", "senior engineer",
                             "lead engineer/staff engineer", "engineering manager/architect"),
    "Data": ("data analyst", "senior data analyst", "data scientist", "senior data scientist",
             "lead data scientist/head of data"),
    "Product": ("associate product manager", "product manager", "senior product manager",
                "group product manager/head of product"),
    "Human resources": ("hr executive", "hr generalist", "hr business partner", "senior hr business partner",
                        "hr manager", "hr director", "chief hr officer"),
    "Finance": ("accountant", "senior accountant", "finance manager", "finance director", "cfo"),
    "Sales": ("sales executive", "account manager", "senior account manager", "sales manager", "head of sales"),
    "Operations": ("operations executive", "operations manager", "senior operations manager",
                   "operations director"),
    "Marketing": ("marketing executive", "marketing manager", "senior marketing manager", "marketing director"),
    "Manufacturing production": ("production associate", "production supervisor", "production engineer",
                                 "senior production engineer", "plant manager",
                                 "plant head/director of manufacturing"),
    "Manufacturing quality": ("qa inspector", "quality engineer", "senior quality engineer", "quality manager",
                              "head of quality"),
    "Maintenance and reliability": ("maintenance technician", "maintenance engineer",
                                    "senior maintenance engineer", "maintenance manager", "head of maintenance"),
    "Automotive engineering": ("graduate engineer", "design engineer", "senior engineer",
                               "chief engineer/engineering manager"),
    "Automotive aftersales": ("service advisor", "service manager", "aftersales manager", "head of aftersales"),
    "Pharma quality": ("qc analyst", "qa officer", "qa manager", "head of quality"),
    "Pharma regulatory": ("regulatory affairs associate", "regulatory affairs manager",
                          "head of regulatory affairs"),
    "Pharma production": ("production officer", "production executive", "production manager", "plant head"),
    "FMCG sales": ("sales executive", "area sales manager", "regional sales manager", "national sales head"),
    "FMCG brand and marketing": ("brand executive", "assistant brand manager", "brand manager",
                                 "senior brand manager", "marketing director"),
    "FMCG supply chain": ("supply chain executive", "demand planner", "supply chain manager",
                          "head of supply chain"),
}

# Related families (3 points) must be listed explicitly: "no guessing" (docs/ATS_RULES.md, section 4).
# Only the two pairs named in that file are listed; more are added through the review.
RELATED_FAMILIES: Set[frozenset] = {
    frozenset(("Human resources", "Operations")),
    frozenset(("Data", "Finance")),
}

# 5. Sector terms (check B7).
SECTOR_TERMS: Dict[str, Tuple[str, ...]] = {
    "Human resources": ("talent acquisition", "employee relations", "performance management",
                        "workforce planning", "learning and development", "compensation and benefits",
                        "onboarding", "hr policy", "compliance", "succession planning"),
    "Software": ("api", "microservices", "testing", "code review", "deployment", "cloud", "databases",
                 "security", "agile", "scalability"),
    "Finance": ("budgeting", "forecasting", "reconciliation", "reporting", "audit", "cash flow",
                "compliance", "variance analysis", "ifrs", "gaap"),
    "Sales": ("pipeline", "quota", "account management", "negotiation", "revenue", "crm", "prospecting",
              "retention", "forecasting"),
    "Operations": ("supply chain", "logistics", "process improvement", "inventory", "vendor management",
                   "kpis", "lean", "quality"),
    "Manufacturing": ("lean manufacturing", "six sigma", "oee", "production planning", "quality control",
                      "iso 9001", "root cause analysis", "5s", "kaizen", "preventive maintenance",
                      "shop floor", "ehs compliance", "bill of materials", "capa"),
    "Automotive": ("apqp", "ppap", "fmea", "iatf 16949", "oem", "tier-1 supplier", "homologation",
                   "vehicle validation", "powertrain", "lean manufacturing"),
    "Pharma": ("gmp", "cgmp", "glp", "process validation", "regulatory submissions", "cdsco", "usfda",
               "pharmacovigilance", "batch records", "deviation management", "stability studies"),
    "FMCG": ("route to market", "distribution", "general trade", "modern trade", "trade marketing",
             "shelf availability", "category management", "brand equity", "demand planning",
             "retail execution"),
    "Marketing": ("campaigns", "brand", "digital marketing", "seo", "content", "analytics",
                  "lead generation", "social media"),
}

# Standard section headings (check A2): the three the check looks for.
STANDARD_HEADINGS: Dict[str, Tuple[str, ...]] = {
    # Plain "Experience" is deliberately not here (decided 2026-10-31; docs/ATS_FRAMEWORK.md).
    "experience": ("work experience", "professional experience", "work history"),
    "education": ("education", "education and training", "academic qualifications", "qualifications"),
    "skills": ("skills", "key skills", "technical skills", "core skills", "core competencies"),
}


def all_lists() -> List[Tuple[str, List[str]]]:
    """Named lists whose entries must not appear in two lists (tests/test_ats_lists.py)."""
    return [
        ("action verbs", list(ACTION_VERBS)),
        ("weak openers", list(WEAK_OPENERS)),
    ]
