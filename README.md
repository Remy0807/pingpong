# pingpong

## Frontend deployen

Voor een productiebuild moet je de URL van de back-end opgeven zodat de app de juiste API aanspreekt.

1. Maak een bestand `.env.production` aan in de projectroot met bijvoorbeeld:
   ```
   VITE_API_BASE_URL=https://pingpong-vu5r.onrender.com
   ```
2. Draai daarna `npm run build`. De output staat in `dist/`.
3. Upload de inhoud van `dist/` naar je TransIP `public_html` map.

Let op: verander je backend-URL? Pas dan eerst `VITE_API_BASE_URL` aan en bouw opnieuw.

## Server authenticatie & sociale functies

De API gebruikt nu eigen JWT-tokens. Zet in je server-omgeving een sterke `JWT_SECRET` in `.env` (Render ondersteunt dit als environment variable). Zonder deze waarde start de server niet op.

Nieuwe endpoints:

- `POST /auth/register` en `POST /auth/login` leveren een JWT en basisprofiel terug.
- `GET /auth/me` valideert de token.
- `GET /api/friends`, `POST /api/friends/request`, `POST /api/friends/respond` beheren vriendschappen.
- `GET /api/groups`, `POST /api/groups` en `POST /api/groups/:id/invite` plus `POST /api/groups/invites/:inviteId/respond` regelen groepslidmaatschap en uitnodigingen (alleen tussen vrienden).

Alle muterende routes verwachten een `Authorization: Bearer <token>` header. Render (backend + Postgres) en TransIP (frontend) blijven gewoon bruikbaar: de tokens zijn volledig stateless en de extra tabellen staan in dezelfde database.

## Frontend flows

- Bij het openen van de app verschijnen nu login/registratieformulieren. Na een succesvolle login wordt de JWT lokaal bewaard en automatisch meegestuurd met API-calls.
- In het hoofdmenu vind je nieuwe pagina’s:
  - **Vrienden**: verzend/accept/annuleer vriendschapsverzoeken.
  - **Groepen**: maak groepen, nodig vrienden uit en beheer uitnodigingen.
- Via het gebruikerskaartje rechtsboven kun je het actieve account uitloggen (token wordt verwijderd).
