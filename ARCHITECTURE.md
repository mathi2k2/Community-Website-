# Bloomfield BCCC — Full Architecture Plan
## Bloomfield Cricket & Cultural Club | Winnipeg, Manitoba

---

## 1. PROJECT OVERVIEW

### What This Is
A full-featured web application for the Bloomfield Cricket and Cultural Club (BCCC)
in Winnipeg, Manitoba. Not a static site — a living platform that serves the club's
members, visitors, local businesses, and the broader cricket community.

### About the Club
The club name references the historic **Bloomfield Cricket and Athletic Club** in
Colombo, Sri Lanka (est. 1892) — a common naming convention among South Asian
diaspora cricket communities. BCCC operates within the **Manitoba Cricket
Association (MCA)** ecosystem, which runs **58 teams across 5 divisions** (Elite,
Premier, Division 1, 2, 3) plus a T20 format during Manitoba's summer season. The
MCA uses **CricketSASA** for live scoring — our platform is complementary (stats
archive, club identity, community features), not a replacement for match-day scoring.

**BCCC in the Manitoba Cricket League:**
- **Premier Division** team
- **Division 2** team
- **Division 3** team
- **Recreational** team (4th team, casual/development)
- Total: **4 teams** (3 competitive + 1 recreational)

**Softball (Tennis Ball) Cricket:**
- Fundraiser events using tennis ball format
- Mock auction system — players are "bought" by team captains
- All scores and stats tracked for bragging rights and future auctions
- Community-wide participation (not just registered MCA players)

### Who Uses It

| User Type         | What They Do                                                        |
|-------------------|---------------------------------------------------------------------|
| **Visitor**       | Learn about the club, browse events, read blog, view stats          |
| **Member**        | Buy tickets, post in blog, list on marketplace, view their stats    |
| **Player**        | View personal stats dashboard, career records across both formats   |
| **Business Owner**| Create a listing in the business directory, manage their ad         |
| **Admin**         | Enter match scores, manage events, approve businesses, moderate     |

### Core Feature Areas

1. **Public Club Info** — what the club has done, is doing, and will do
2. **Business Directory** — local businesses advertise to the community
3. **Event Ticketing** — buy tickets for events via Stripe
4. **Cricket Stats Engine** — tennis ball (fundraisers/auctions) + hardball (Manitoba Cricket League, 4 teams)
5. **Marketplace** — buy/sell within the community
6. **Blog** — member stories and experiences

---

## 2. TECH STACK DECISION

After evaluating the requirements, here's what we're building with and **why**:

### Frontend: Next.js 15 (App Router) + TypeScript + Tailwind CSS

**Why Next.js:**
- Server-side rendering = great SEO for public pages (Google finds events, player stats, blog posts)
- App Router gives us layouts, loading states, error boundaries, and server components out of the box
- API routes live alongside frontend — no separate backend server to manage
- React ecosystem = massive library support for charts (stats), rich text editors (blog), etc.
- Vercel deployment = zero-config, free tier handles a community site easily
- TypeScript catches bugs before they reach production

**Why Tailwind CSS:**
- Rapid UI development, responsive by default
- Dark mode toggle built in
- Consistent design system via config file
- No CSS file management headaches

### Backend: Supabase (hosted PostgreSQL + Auth + Storage + Realtime)

**Why Supabase:**
- **PostgreSQL** — relational database is PERFECT for cricket stats (players → teams → matches → innings → stats). You can't model this well in a document DB.
- **Built-in Auth** — email/password, Google, magic links. No auth code to write or maintain.
- **Row-Level Security (RLS)** — database-level permissions. A member can only edit their own listings. An admin can enter scores. No leaky APIs.
- **Storage** — for marketplace photos, blog images, business logos. Integrated with auth.
- **Realtime** — live score updates during matches (future feature)
- **Free tier** — 500MB database, 1GB storage, 50k monthly active users. More than enough for BCCC.
- **Dashboard** — built-in admin UI to inspect data, run queries, manage users

**Why NOT Firebase:** No relational data support. Cricket stats need JOINs and aggregations.
**Why NOT custom Express/Django:** More code to write, more to host, more to maintain. Supabase gives us 80% of the backend for free.

### Payments: Stripe

- Industry standard, works in Canada (CAD), low fees (2.9% + 30¢)
- Test mode for development
- Stripe Checkout = hosted payment page (PCI compliant, we never touch card numbers)
- Webhooks to confirm payments and issue tickets

### Deployment: Vercel + Supabase Cloud

- Vercel: free tier, automatic deployments from GitHub, edge network
- Supabase Cloud: managed PostgreSQL, no server to maintain
- Custom domain: bloomfieldbccc.ca (or .com)

---

## 3. DATABASE SCHEMA

### 3.1 Users & Authentication

```
profiles
├── id                UUID (PK, matches Supabase auth.users.id)
├── email             TEXT (from auth)
├── display_name      TEXT
├── full_name         TEXT
├── avatar_url        TEXT
├── phone             TEXT
├── bio               TEXT
├── role              ENUM ('visitor', 'member', 'player', 'business_owner', 'admin')
├── is_active         BOOLEAN DEFAULT true
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ
```

### 3.2 Cricket Stats Engine

```
players
├── id                UUID (PK)
├── profile_id        UUID (FK → profiles.id, nullable — not all players are app users)
├── first_name        TEXT NOT NULL
├── last_name         TEXT NOT NULL
├── nickname          TEXT
├── photo_url         TEXT
├── plays_tennis_ball BOOLEAN DEFAULT false (tennis ball/fundraiser format)
├── plays_hardball    BOOLEAN DEFAULT false (Manitoba Cricket League)
├── batting_style     ENUM ('right_hand', 'left_hand')
├── bowling_style     TEXT (e.g., 'right_arm_medium', 'left_arm_spin')
├── is_active         BOOLEAN DEFAULT true
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ

teams
├── id                UUID (PK)
├── name              TEXT NOT NULL
├── league            ENUM ('tennis_ball', 'mcl_premier', 'mcl_div2', 'mcl_div3', 'mcl_recreational')
├── season_id         UUID (FK → seasons.id)
├── captain_id        UUID (FK → players.id)
├── logo_url          TEXT
├── color             TEXT (hex color for UI)
├── division          TEXT (e.g., 'Premier', 'Division 2', 'Division 3', 'Recreational')
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ

seasons
├── id                UUID (PK)
├── year              INTEGER NOT NULL
├── league            ENUM ('tennis_ball', 'manitoba_cricket_league')
├── name              TEXT (e.g., "Summer 2025", "Fundraiser Gala 2025")
├── is_active         BOOLEAN DEFAULT false
├── start_date        DATE
├── end_date          DATE
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ

team_players (junction table — players belong to teams per season)
├── id                UUID (PK)
├── team_id           UUID (FK → teams.id)
├── player_id         UUID (FK → players.id)
├── season_id         UUID (FK → seasons.id)
├── auction_price     DECIMAL (nullable — only for tennis ball fundraiser auctions)
├── is_captain        BOOLEAN DEFAULT false
├── created_at        TIMESTAMPTZ
└── UNIQUE(team_id, player_id, season_id)

matches
├── id                UUID (PK)
├── season_id         UUID (FK → seasons.id)
├── league            ENUM ('tennis ball_fundraiser', 'manitoba_cricket_league')
├── match_number      INTEGER
├── team_a_id         UUID (FK → teams.id)
├── team_b_id         UUID (FK → teams.id)
├── date              DATE NOT NULL
├── venue             TEXT
├── toss_winner_id    UUID (FK → teams.id, nullable)
├── toss_decision     ENUM ('bat', 'bowl', nullable)
├── team_a_score      TEXT (e.g., "156/7")
├── team_b_score      TEXT (e.g., "142/10")
├── winner_id         UUID (FK → teams.id, nullable for ties/draws)
├── result_summary    TEXT (e.g., "Team A won by 14 runs")
├── match_type        TEXT (e.g., 'league', 'semifinal', 'final', 'friendly')
├── overs_per_side    INTEGER (e.g., 20 for T20, 6 for tennis ball)
├── status            ENUM ('upcoming', 'in_progress', 'completed', 'cancelled')
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ

batting_innings
├── id                UUID (PK)
├── match_id          UUID (FK → matches.id)
├── player_id         UUID (FK → players.id)
├── team_id           UUID (FK → teams.id)
├── batting_order     INTEGER
├── runs              INTEGER DEFAULT 0
├── balls_faced       INTEGER DEFAULT 0
├── fours             INTEGER DEFAULT 0
├── sixes             INTEGER DEFAULT 0
├── not_out           BOOLEAN DEFAULT false
├── dismissal_type    ENUM ('bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'retired', 'not_out', null)
├── bowler_id         UUID (FK → players.id, nullable — who got the wicket)
├── fielder_id        UUID (FK → players.id, nullable — who caught/ran out)
├── created_at        TIMESTAMPTZ
└── UNIQUE(match_id, player_id)

bowling_innings
├── id                UUID (PK)
├── match_id          UUID (FK → matches.id)
├── player_id         UUID (FK → players.id)
├── team_id           UUID (FK → teams.id)
├── overs             DECIMAL (e.g., 4.0, 3.2)
├── maidens           INTEGER DEFAULT 0
├── runs_conceded     INTEGER DEFAULT 0
├── wickets           INTEGER DEFAULT 0
├── wides             INTEGER DEFAULT 0
├── no_balls          INTEGER DEFAULT 0
├── economy_rate      DECIMAL (computed)
├── created_at        TIMESTAMPTZ
└── UNIQUE(match_id, player_id)

auctions
├── id                UUID (PK)
├── season_id         UUID (FK → seasons.id)
├── date              DATE
├── total_purse       DECIMAL (each team's budget)
├── status            ENUM ('upcoming', 'in_progress', 'completed')
├── notes             TEXT
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ
```

**Key design decisions:**
- `players` is separate from `profiles` because not every cricket player may have an app account (especially older data/historical records)
- `team_players` junction table handles the fact that players change teams between seasons (especially with the auction)
- `auction_price` lives on `team_players` because a player's price is per-season, per-team
- Both `batting_innings` and `bowling_innings` per match allow full scorecard reconstruction
- `league` enum cleanly separates tennis ball fundraiser stats from Manitoba Cricket League stats
- Aggregate stats (career batting average, strike rate, etc.) are computed via **database views**, not stored — always accurate, never stale

### 3.3 Database Views (Computed Stats)

```sql
-- Player batting career stats (per league)
CREATE VIEW player_batting_stats AS
SELECT
  p.id AS player_id,
  p.first_name,
  p.last_name,
  m.league,
  COUNT(bi.id) AS innings,
  SUM(bi.runs) AS total_runs,
  MAX(bi.runs) AS highest_score,
  ROUND(AVG(bi.runs), 2) AS batting_average,
  SUM(bi.fours) AS total_fours,
  SUM(bi.sixes) AS total_sixes,
  SUM(bi.balls_faced) AS total_balls,
  CASE WHEN SUM(bi.balls_faced) > 0
    THEN ROUND(SUM(bi.runs)::DECIMAL / SUM(bi.balls_faced) * 100, 2)
    ELSE 0
  END AS strike_rate,
  COUNT(CASE WHEN bi.runs >= 50 THEN 1 END) AS fifties,
  COUNT(CASE WHEN bi.runs >= 100 THEN 1 END) AS centuries
FROM players p
JOIN batting_innings bi ON p.id = bi.player_id
JOIN matches m ON bi.match_id = m.id
WHERE m.status = 'completed'
GROUP BY p.id, p.first_name, p.last_name, m.league;

-- Player bowling career stats (per league)
CREATE VIEW player_bowling_stats AS
SELECT
  p.id AS player_id,
  p.first_name,
  p.last_name,
  m.league,
  COUNT(bw.id) AS innings,
  SUM(bw.overs) AS total_overs,
  SUM(bw.wickets) AS total_wickets,
  SUM(bw.runs_conceded) AS total_runs_conceded,
  SUM(bw.maidens) AS total_maidens,
  CASE WHEN SUM(bw.wickets) > 0
    THEN ROUND(SUM(bw.runs_conceded)::DECIMAL / SUM(bw.wickets), 2)
    ELSE NULL
  END AS bowling_average,
  CASE WHEN SUM(bw.overs) > 0
    THEN ROUND(SUM(bw.runs_conceded)::DECIMAL / SUM(bw.overs), 2)
    ELSE 0
  END AS economy_rate,
  MAX(bw.wickets) AS best_wickets,
  COUNT(CASE WHEN bw.wickets >= 3 THEN 1 END) AS three_wicket_hauls,
  COUNT(CASE WHEN bw.wickets >= 5 THEN 1 END) AS five_wicket_hauls
FROM players p
JOIN bowling_innings bw ON p.id = bw.player_id
JOIN matches m ON bw.match_id = m.id
WHERE m.status = 'completed'
GROUP BY p.id, p.first_name, p.last_name, m.league;

-- Season leaderboards
CREATE VIEW season_batting_leaderboard AS
SELECT
  p.id, p.first_name, p.last_name,
  s.year, s.league,
  SUM(bi.runs) AS runs,
  COUNT(bi.id) AS innings,
  ROUND(AVG(bi.runs), 2) AS average,
  MAX(bi.runs) AS high_score
FROM players p
JOIN batting_innings bi ON p.id = bi.player_id
JOIN matches m ON bi.match_id = m.id
JOIN seasons s ON m.season_id = s.id
WHERE m.status = 'completed'
GROUP BY p.id, p.first_name, p.last_name, s.year, s.league
ORDER BY runs DESC;
```

### 3.4 Events & Ticketing

```
events
├── id                UUID (PK)
├── title             TEXT NOT NULL
├── slug              TEXT UNIQUE
├── description       TEXT (rich text / markdown)
├── date              DATE NOT NULL
├── time              TIME
├── end_date          DATE (nullable, for multi-day events)
├── venue             TEXT
├── venue_address     TEXT
├── cover_image_url   TEXT
├── is_ticketed       BOOLEAN DEFAULT false
├── status            ENUM ('draft', 'published', 'cancelled', 'completed')
├── created_by        UUID (FK → profiles.id)
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ

ticket_types
├── id                UUID (PK)
├── event_id          UUID (FK → events.id)
├── name              TEXT (e.g., "General Admission", "VIP", "Family Pack")
├── price_cents       INTEGER (stored in cents to avoid float issues)
├── quantity_total    INTEGER
├── quantity_sold     INTEGER DEFAULT 0
├── description       TEXT
├── sale_start        TIMESTAMPTZ
├── sale_end          TIMESTAMPTZ
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ

orders
├── id                UUID (PK)
├── user_id           UUID (FK → profiles.id)
├── event_id          UUID (FK → events.id)
├── total_cents       INTEGER
├── stripe_session_id TEXT
├── stripe_payment_id TEXT
├── status            ENUM ('pending', 'paid', 'refunded', 'cancelled')
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ

order_items
├── id                UUID (PK)
├── order_id          UUID (FK → orders.id)
├── ticket_type_id    UUID (FK → ticket_types.id)
├── quantity          INTEGER
├── unit_price_cents  INTEGER (snapshot at time of purchase)
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ

tickets (individual issued tickets)
├── id                UUID (PK)
├── order_item_id     UUID (FK → order_items.id)
├── ticket_code       TEXT UNIQUE (for QR code / check-in)
├── attendee_name     TEXT
├── is_checked_in     BOOLEAN DEFAULT false
├── checked_in_at     TIMESTAMPTZ
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ
```

### 3.5 Marketplace

```
listing_categories
├── id                UUID (PK)
├── name              TEXT NOT NULL
├── slug              TEXT UNIQUE
├── icon              TEXT (emoji or icon name)
└── sort_order        INTEGER

listings
├── id                UUID (PK)
├── seller_id         UUID (FK → profiles.id)
├── category_id       UUID (FK → listing_categories.id)
├── title             TEXT NOT NULL
├── description       TEXT
├── price_cents       INTEGER (0 = free)
├── condition         ENUM ('new', 'like_new', 'good', 'fair', 'for_parts')
├── is_negotiable     BOOLEAN DEFAULT false
├── location          TEXT (neighbourhood in Winnipeg)
├── status            ENUM ('active', 'sold', 'reserved', 'removed')
├── views_count       INTEGER DEFAULT 0
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ

listing_images
├── id                UUID (PK)
├── listing_id        UUID (FK → listings.id)
├── image_url         TEXT NOT NULL
├── sort_order        INTEGER DEFAULT 0
└── created_at        TIMESTAMPTZ

conversations (messaging between buyer/seller)
├── id                UUID (PK)
├── listing_id        UUID (FK → listings.id)
├── buyer_id          UUID (FK → profiles.id)
├── seller_id         UUID (FK → profiles.id)
├── last_message_at   TIMESTAMPTZ
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ

messages
├── id                UUID (PK)
├── conversation_id   UUID (FK → conversations.id)
├── sender_id         UUID (FK → profiles.id)
├── body              TEXT NOT NULL
├── is_read           BOOLEAN DEFAULT false
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ
```

### 3.6 Blog

```
posts
├── id                UUID (PK)
├── author_id         UUID (FK → profiles.id)
├── title             TEXT NOT NULL
├── slug              TEXT UNIQUE
├── content           TEXT (markdown or rich text JSON)
├── excerpt           TEXT (auto-generated or manual, 160 chars)
├── cover_image_url   TEXT
├── status            ENUM ('draft', 'published', 'archived')
├── is_featured       BOOLEAN DEFAULT false
├── published_at      TIMESTAMPTZ
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ

post_tags
├── id                UUID (PK)
├── name              TEXT NOT NULL
├── slug              TEXT UNIQUE
└── created_at        TIMESTAMPTZ

post_tag_map (junction)
├── post_id           UUID (FK → posts.id)
├── tag_id            UUID (FK → post_tags.id)
└── PRIMARY KEY (post_id, tag_id)

post_comments
├── id                UUID (PK)
├── post_id           UUID (FK → posts.id)
├── author_id         UUID (FK → profiles.id)
├── body              TEXT NOT NULL
├── is_approved       BOOLEAN DEFAULT true
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ
```

### 3.7 Business Directory

```
business_categories
├── id                UUID (PK)
├── name              TEXT NOT NULL
├── slug              TEXT UNIQUE
├── icon              TEXT
└── sort_order        INTEGER

businesses
├── id                UUID (PK)
├── owner_id          UUID (FK → profiles.id)
├── category_id       UUID (FK → business_categories.id)
├── name              TEXT NOT NULL
├── slug              TEXT UNIQUE
├── description       TEXT
├── logo_url          TEXT
├── cover_image_url   TEXT
├── address           TEXT
├── city              TEXT DEFAULT 'Winnipeg'
├── phone             TEXT
├── email             TEXT
├── website           TEXT
├── instagram         TEXT
├── facebook          TEXT
├── hours             JSONB (structured operating hours)
├── is_featured       BOOLEAN DEFAULT false
├── is_approved       BOOLEAN DEFAULT false
├── status            ENUM ('pending', 'approved', 'rejected', 'inactive')
├── created_at        TIMESTAMPTZ
└── updated_at        TIMESTAMPTZ
```

---

## 4. PAGE MAP & ROUTING

```
ROUTE                              PAGE                         AUTH?    NOTES
─────────────────────────────────────────────────────────────────────────────────

PUBLIC PAGES
/                                  Home                         No       Hero, upcoming events, recent results, featured businesses
/about                             About the Club               No       History, mission, photos
/events                            Events List                  No       Filterable by upcoming/past
/events/[slug]                     Event Detail                 No       Info, ticket purchase (auth for checkout)
/cricket                           Cricket Hub                  No       Overview, current season standings
/cricket/players                   Players Directory            No       Search/filter, card grid
/cricket/players/[id]              Player Profile               No       Career stats, match history, both formats
/cricket/teams                     Teams                        No       Current season teams
/cricket/teams/[id]                Team Detail                  No       Roster, match results, standings
/cricket/matches                   Match Results                No       Filterable by season/league
/cricket/matches/[id]              Match Scorecard              No       Full batting/bowling scorecard
/cricket/leaderboard               Leaderboard                  No       Top batsmen, bowlers — toggle tennis ball/hardball
/cricket/auction                   Auction Results              No       Per-season auction results, player values
/marketplace                       Marketplace                  No       Browse listings
/marketplace/[id]                  Listing Detail               No       Photos, description, contact seller (auth)
/blog                              Blog List                    No       Posts grid, tag filtering
/blog/[slug]                       Blog Post                    No       Full post, comments (auth to comment)
/directory                         Business Directory           No       Category browse, search
/directory/[slug]                  Business Profile             No       Full business page
/contact                           Contact                      No       Form, location info

AUTHENTICATED PAGES
/dashboard                         Member Dashboard             Yes      Overview, my stats, my tickets
/dashboard/tickets                 My Tickets                   Yes      Order history, QR codes
/dashboard/stats                   My Cricket Stats             Yes      Personal stats if linked to player
/dashboard/listings                My Marketplace Listings      Yes      Manage my listings
/dashboard/messages                Messages                     Yes      Marketplace conversations
/marketplace/new                   Create Listing               Yes      List an item for sale
/marketplace/[id]/edit             Edit Listing                 Yes      Owner only
/blog/new                          Write Blog Post              Yes      Rich text editor
/blog/[slug]/edit                  Edit Blog Post               Yes      Author only
/directory/register                Register Business            Yes      Business registration form

ADMIN PAGES
/admin                             Admin Dashboard              Admin    Metrics overview
/admin/events                      Manage Events                Admin    CRUD events + ticket types
/admin/cricket/matches/new         Enter Match Scores           Admin    Scorecard entry form
/admin/cricket/players             Manage Players               Admin    Add/edit players
/admin/cricket/teams               Manage Teams                 Admin    Team setup, roster assignment
/admin/cricket/auction             Manage Auction               Admin    Enter auction results
/admin/blog                        Moderate Blog                Admin    Approve/reject posts
/admin/businesses                  Moderate Businesses           Admin    Approve/reject listings
/admin/marketplace                 Moderate Marketplace          Admin    Remove inappropriate listings
/admin/users                       Manage Users                 Admin    Roles, ban/activate
```

---

## 5. API ROUTES (Next.js Route Handlers)

```
CRICKET
POST   /api/cricket/matches              Create match (admin)
PUT    /api/cricket/matches/[id]         Update match + scores (admin)
POST   /api/cricket/matches/[id]/batting Submit batting innings (admin)
POST   /api/cricket/matches/[id]/bowling Submit bowling innings (admin)
POST   /api/cricket/players              Create player (admin)
PUT    /api/cricket/players/[id]         Update player (admin)
POST   /api/cricket/teams                Create team (admin)
PUT    /api/cricket/teams/[id]           Update team (admin)
POST   /api/cricket/auctions             Create auction (admin)
POST   /api/cricket/auctions/[id]/picks  Submit auction picks (admin)

EVENTS & TICKETS
POST   /api/events                       Create event (admin)
PUT    /api/events/[id]                  Update event (admin)
POST   /api/events/[id]/ticket-types     Create ticket type (admin)
POST   /api/checkout                     Create Stripe checkout session
POST   /api/webhooks/stripe              Stripe webhook (confirm payment, issue tickets)
POST   /api/tickets/[id]/check-in        Check in a ticket (admin)

MARKETPLACE
POST   /api/listings                     Create listing (member)
PUT    /api/listings/[id]                Update listing (owner)
DELETE /api/listings/[id]                Remove listing (owner/admin)
POST   /api/listings/[id]/images         Upload images (owner)
POST   /api/conversations                Start conversation (member)
POST   /api/conversations/[id]/messages  Send message (participant)

BLOG
POST   /api/posts                        Create post (member)
PUT    /api/posts/[id]                   Update post (author/admin)
POST   /api/posts/[id]/comments          Add comment (member)

BUSINESS DIRECTORY
POST   /api/businesses                   Register business (member)
PUT    /api/businesses/[id]              Update business (owner/admin)
PUT    /api/businesses/[id]/approve      Approve/reject (admin)

AUTH & PROFILE
PUT    /api/profile                      Update own profile
POST   /api/profile/avatar               Upload avatar
```

---

## 6. KEY UI COMPONENTS

### Shared / Layout
- `<SiteHeader />` — nav with auth state, mobile hamburger
- `<SiteFooter />` — links, social icons, newsletter signup
- `<ThemeToggle />` — dark/light mode
- `<Container />` — max-width wrapper
- `<PageHero />` — reusable page header with title + breadcrumb
- `<Card />` — base card component
- `<Badge />` — status/tag badges
- `<Modal />` — reusable dialog
- `<DataTable />` — sortable table (for stats, admin lists)
- `<EmptyState />` — friendly empty states with illustrations
- `<LoadingSkeleton />` — shimmer loading placeholders

### Cricket-Specific
- `<Scorecard />` — full match scorecard (batting + bowling tables)
- `<PlayerCard />` — player photo, name, key stats
- `<StatsTable />` — career stats with sortable columns
- `<LeaderboardTable />` — ranked list with highlight for top 3
- `<MatchCard />` — match summary (teams, scores, result)
- `<TeamBadge />` — team color + logo inline
- `<SeasonSelector />` — dropdown to switch seasons
- `<LeagueToggle />` — tennis ball ↔ hardball switch
- `<AuctionBoard />` — auction results grid (player, team, price)
- `<MiniScorecard />` — compact version for sidebar/homepage

### Events & Tickets
- `<EventCard />` — event preview with date, image, price
- `<TicketSelector />` — quantity picker per ticket type
- `<CheckoutButton />` — triggers Stripe checkout
- `<TicketQR />` — QR code display for issued tickets
- `<EventCalendar />` — month view of upcoming events

### Marketplace
- `<ListingCard />` — photo, title, price, condition badge
- `<ListingForm />` — create/edit listing with image upload
- `<ImageGallery />` — lightbox image viewer
- `<ChatBubble />` — message UI for buyer/seller conversations
- `<PriceFilter />` — range slider for price filtering

### Blog
- `<PostCard />` — cover image, title, excerpt, author, date
- `<RichTextEditor />` — for writing blog posts (Tiptap or similar)
- `<CommentThread />` — nested comments UI
- `<TagCloud />` — browsable tag list

### Business Directory
- `<BusinessCard />` — logo, name, category, featured badge
- `<BusinessHours />` — formatted operating hours
- `<CategoryFilter />` — sidebar filter by business category

---

## 7. PHASED BUILD PLAN

### Phase 1: Foundation (Week 1–2)
**Goal: Project skeleton, auth, database, public shell**

- [ ] Initialize Next.js 15 project with TypeScript + Tailwind
- [ ] Set up Supabase project (database, auth, storage buckets)
- [ ] Create all database tables + RLS policies
- [ ] Build shared layout: Header, Footer, ThemeToggle, Container
- [ ] Build auth flow: Sign up, Login, Profile page
- [ ] Build Home page (static content for now, wired layout)
- [ ] Build About page
- [ ] Set up Vercel deployment pipeline
- [ ] Seed database with sample data for development

### Phase 2: Cricket Stats Engine (Week 3–5)
**Goal: Full stats system — the core differentiator**

- [ ] Admin: Score entry form (match + batting + bowling innings)
- [ ] Admin: Player CRUD, Team CRUD, Season management
- [ ] Admin: Auction entry form
- [ ] Public: Match results list (filterable by season, league)
- [ ] Public: Match scorecard page (full batting/bowling details)
- [ ] Public: Player directory with search
- [ ] Public: Player profile — career stats for tennis ball + hardball
- [ ] Public: Team page — roster, results, standings
- [ ] Public: Leaderboard — top batsmen, bowlers, toggle by format
- [ ] Public: Auction results page
- [ ] Create database views for aggregated stats
- [ ] Homepage widget: latest results, upcoming matches
- [ ] Seed with real historical BCCC match data

### Phase 3: Events & Ticketing (Week 6–7)
**Goal: People can buy tickets for events through the site**

- [ ] Admin: Event CRUD + ticket type management
- [ ] Public: Events listing page (upcoming / past tabs)
- [ ] Public: Event detail page
- [ ] Stripe integration: Checkout session creation
- [ ] Stripe webhook: Payment confirmation → ticket issuance
- [ ] Generate unique ticket codes (for QR)
- [ ] Dashboard: My Tickets page with QR codes
- [ ] Admin: Check-in scanner (camera QR reader or manual code entry)
- [ ] Homepage widget: upcoming events

### Phase 4: Business Directory (Week 8)
**Goal: Local businesses can advertise to the community**

- [ ] Database: business categories seeded (Restaurant, Grocery, Services, etc.)
- [ ] Public: Directory page with category filter + search
- [ ] Public: Business profile page
- [ ] Auth: Business registration form
- [ ] Admin: Approve/reject business applications
- [ ] Homepage: Featured businesses carousel/grid
- [ ] Business dashboard: Edit own listing

### Phase 5: Blog (Week 9)
**Goal: Members share stories about the club**

- [ ] Rich text editor integration (Tiptap)
- [ ] Auth: Create/edit blog posts
- [ ] Public: Blog listing with tag filtering
- [ ] Public: Blog post page with comments
- [ ] Admin: Moderate posts and comments
- [ ] Homepage: Featured/latest blog posts

### Phase 6: Marketplace (Week 10–11)
**Goal: Community buy/sell platform**

- [ ] Auth: Create listing with multi-image upload
- [ ] Public: Marketplace browse with category/price filters
- [ ] Public: Listing detail with image gallery
- [ ] Messaging: Buyer/seller conversation system
- [ ] Dashboard: My Listings management
- [ ] Dashboard: Messages inbox
- [ ] Admin: Moderate listings (remove inappropriate)
- [ ] Notification system for new messages

### Phase 7: Polish & Launch (Week 12)
**Goal: Production-ready**

- [ ] SEO: meta tags, Open Graph, structured data (JSON-LD for events)
- [ ] Performance: image optimization, lazy loading, caching
- [ ] PWA: service worker for offline access to stats
- [ ] Email notifications (Resend or Supabase built-in)
- [ ] Analytics: Vercel Analytics or Plausible
- [ ] Error monitoring: Sentry
- [ ] Final QA across devices
- [ ] Custom domain setup (bloomfieldbccc.ca)
- [ ] Launch!

---

## 8. FOLDER STRUCTURE

```
bloomfield-bccc/
├── app/
│   ├── layout.tsx                    # Root layout (header, footer, providers)
│   ├── page.tsx                      # Home page
│   ├── globals.css                   # Tailwind base + custom styles
│   ├── about/
│   │   └── page.tsx
│   ├── events/
│   │   ├── page.tsx                  # Events list
│   │   └── [slug]/
│   │       └── page.tsx              # Event detail
│   ├── cricket/
│   │   ├── page.tsx                  # Cricket hub
│   │   ├── players/
│   │   │   ├── page.tsx              # Players directory
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Player profile
│   │   ├── teams/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── matches/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Scorecard
│   │   ├── leaderboard/
│   │   │   └── page.tsx
│   │   └── auction/
│   │       └── page.tsx
│   ├── marketplace/
│   │   ├── page.tsx
│   │   ├── new/
│   │   │   └── page.tsx
│   │   └── [id]/
│   │       ├── page.tsx
│   │       └── edit/
│   │           └── page.tsx
│   ├── blog/
│   │   ├── page.tsx
│   │   ├── new/
│   │   │   └── page.tsx
│   │   └── [slug]/
│   │       ├── page.tsx
│   │       └── edit/
│   │           └── page.tsx
│   ├── directory/
│   │   ├── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── [slug]/
│   │       └── page.tsx
│   ├── contact/
│   │   └── page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx                # Dashboard layout with sidebar
│   │   ├── page.tsx                  # Overview
│   │   ├── tickets/
│   │   │   └── page.tsx
│   │   ├── stats/
│   │   │   └── page.tsx
│   │   ├── listings/
│   │   │   └── page.tsx
│   │   └── messages/
│   │       └── page.tsx
│   ├── admin/
│   │   ├── layout.tsx                # Admin layout with sidebar
│   │   ├── page.tsx                  # Admin dashboard
│   │   ├── events/
│   │   │   └── page.tsx
│   │   ├── cricket/
│   │   │   ├── matches/
│   │   │   │   └── new/
│   │   │   │       └── page.tsx      # Score entry form
│   │   │   ├── players/
│   │   │   │   └── page.tsx
│   │   │   ├── teams/
│   │   │   │   └── page.tsx
│   │   │   └── auction/
│   │   │       └── page.tsx
│   │   ├── blog/
│   │   │   └── page.tsx
│   │   ├── businesses/
│   │   │   └── page.tsx
│   │   ├── marketplace/
│   │   │   └── page.tsx
│   │   └── users/
│   │       └── page.tsx
│   ├── auth/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   └── callback/
│   │       └── route.ts              # Supabase auth callback
│   └── api/
│       ├── checkout/
│       │   └── route.ts
│       ├── webhooks/
│       │   └── stripe/
│       │       └── route.ts
│       ├── cricket/
│       │   ├── matches/
│       │   │   └── route.ts
│       │   ├── players/
│       │   │   └── route.ts
│       │   └── teams/
│       │       └── route.ts
│       ├── listings/
│       │   └── route.ts
│       ├── posts/
│       │   └── route.ts
│       ├── businesses/
│       │   └── route.ts
│       └── profile/
│           └── route.ts
├── components/
│   ├── ui/                           # Shared UI primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx
│   │   ├── DataTable.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Textarea.tsx
│   │   ├── LoadingSkeleton.tsx
│   │   └── EmptyState.tsx
│   ├── layout/
│   │   ├── SiteHeader.tsx
│   │   ├── SiteFooter.tsx
│   │   ├── Container.tsx
│   │   ├── PageHero.tsx
│   │   └── ThemeToggle.tsx
│   ├── cricket/
│   │   ├── Scorecard.tsx
│   │   ├── PlayerCard.tsx
│   │   ├── StatsTable.tsx
│   │   ├── LeaderboardTable.tsx
│   │   ├── MatchCard.tsx
│   │   ├── TeamBadge.tsx
│   │   ├── SeasonSelector.tsx
│   │   ├── LeagueToggle.tsx
│   │   ├── AuctionBoard.tsx
│   │   └── MiniScorecard.tsx
│   ├── events/
│   │   ├── EventCard.tsx
│   │   ├── TicketSelector.tsx
│   │   ├── CheckoutButton.tsx
│   │   └── TicketQR.tsx
│   ├── marketplace/
│   │   ├── ListingCard.tsx
│   │   ├── ListingForm.tsx
│   │   ├── ImageGallery.tsx
│   │   └── ChatBubble.tsx
│   ├── blog/
│   │   ├── PostCard.tsx
│   │   ├── RichTextEditor.tsx
│   │   ├── CommentThread.tsx
│   │   └── TagCloud.tsx
│   └── directory/
│       ├── BusinessCard.tsx
│       └── BusinessHours.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client
│   │   ├── server.ts                 # Server Supabase client
│   │   └── admin.ts                  # Service role client (for webhooks)
│   ├── stripe.ts                     # Stripe client setup
│   ├── utils.ts                      # General utilities
│   └── types/
│       ├── database.ts               # Auto-generated from Supabase
│       ├── cricket.ts                # Cricket-specific types
│       ├── events.ts
│       ├── marketplace.ts
│       └── blog.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useSupabase.ts
│   └── useTheme.ts
├── public/
│   ├── images/
│   └── icons/
├── supabase/
│   ├── migrations/                   # SQL migration files
│   │   ├── 001_profiles.sql
│   │   ├── 002_cricket_tables.sql
│   │   ├── 003_events_ticketing.sql
│   │   ├── 004_marketplace.sql
│   │   ├── 005_blog.sql
│   │   ├── 006_business_directory.sql
│   │   └── 007_views_and_functions.sql
│   └── seed.sql                      # Sample data for development
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env.local                        # Supabase + Stripe keys (never committed)
```

---

## 9. SECURITY & ACCESS CONTROL

### Row-Level Security Policies (Supabase RLS)

| Table        | SELECT              | INSERT             | UPDATE              | DELETE             |
|-------------|--------------------|--------------------|--------------------|--------------------|
| profiles    | Everyone (public)  | Auth (own only)    | Auth (own only)    | Admin only         |
| players     | Everyone           | Admin              | Admin              | Admin              |
| teams       | Everyone           | Admin              | Admin              | Admin              |
| matches     | Everyone           | Admin              | Admin              | Admin              |
| batting_innings | Everyone       | Admin              | Admin              | Admin              |
| bowling_innings | Everyone       | Admin              | Admin              | Admin              |
| events      | Published = public | Admin              | Admin              | Admin              |
| orders      | Own only           | Auth (own)         | System (webhook)   | Never              |
| tickets     | Own only           | System             | Admin (check-in)   | Never              |
| listings    | Active = public    | Auth               | Owner              | Owner + Admin      |
| messages    | Participant only   | Auth (participant) | Never              | Never              |
| posts       | Published = public | Auth               | Author + Admin     | Author + Admin     |
| businesses  | Approved = public  | Auth               | Owner + Admin      | Admin              |

### Auth Rules
- Supabase handles JWT tokens, refresh, and session management
- Server components validate session via `createServerClient`
- API routes check auth + role before any mutation
- Admin routes wrapped in middleware that checks `role === 'admin'`
- Stripe webhooks verified via signature (no auth bypass possible)

---

## 10. COSTS & INFRASTRUCTURE

### Free Tier (Covers Launch)

| Service       | Free Tier                          | Monthly Cost |
|--------------|-------------------------------------|-------------|
| Supabase      | 500MB DB, 1GB storage, 50k MAU     | $0          |
| Vercel        | 100GB bandwidth, serverless        | $0          |
| Stripe        | Pay-per-transaction only           | 2.9% + 30¢  |
| Domain        | bloomfieldbccc.ca                  | ~$15/year   |

### When You Outgrow Free Tier

| Service       | Pro Tier                           | Monthly Cost |
|--------------|-------------------------------------|-------------|
| Supabase Pro  | 8GB DB, 100GB storage, unlimited   | $25/mo      |
| Vercel Pro    | More bandwidth, analytics          | $20/mo      |

**Total running cost for a community site: $0–45/month + domain**

---

## 11. FUTURE CONSIDERATIONS (not built yet, but the architecture supports them)

- **Live Score Updates** — Supabase Realtime can push score changes to connected clients
- **Push Notifications** — Web push for match starts, new events, marketplace messages
- **Player Trading / Fantasy** — the auction system is already modeled for this
- **Photo Albums** — Supabase Storage + gallery UI for event/match photos
- **Newsletter** — Resend integration for email digests
- **Multi-language** — next-intl for Punjabi/Hindi support (if the community wants it)
- **Mobile App** — React Native sharing the same Supabase backend
- **Sponsorship Tiers** — paid business listings, banner ads, event sponsors

---

## END OF PLAN

This document is the complete blueprint. Every table, every page, every API route,
every component. Nothing is left ambiguous.

**Next step:** Your approval, then I start building Phase 1.
