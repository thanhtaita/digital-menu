# Routes

## CRUD Resources

- **``** GET/:id | PATCH/:id | DELETE/:id
- **`/:dishId/translations`** GET | GET/:id | PUT/:id | DELETE/:id → Translation
- **`/:id/translations`** GET | GET/:id | PUT/:id | DELETE/:id → Translation
- **`/users/me/restrictions`** GET | POST | GET/:id | DELETE/:id → Restriction

## Other Routes

- `POST` `/dishes/suggest-ingredients` params() [auth]
- `POST` `/register` params() [auth, db]
- `POST` `/login` params() [auth, db]
- `POST` `/logout` params() [auth, db]
- `GET` `/me` params() [auth, db]
- `GET` `/` params() [auth, db]
- `POST` `/` params() [auth, db]
- `POST` `/:dishId/image` params(dishId) [auth, db, upload]
- `POST` `/:dishId/media` params(dishId) [auth, db, upload]
- `PATCH` `/:dishId/media/order` params(dishId) [auth, db, upload]
- `DELETE` `/:dishId/media/:mediaId` params(dishId, mediaId) [auth, db, upload]
- `GET` `/health` params()
- `GET` `/pending` params() [auth, db, upload]
- `POST` `/:id/media` params(id) [auth, db, upload]
- `PATCH` `/:id/media/order` params(id) [auth, db, upload]
- `DELETE` `/:id/media/:mediaId` params(id, mediaId) [auth, db, upload]
- `POST` `/:id/image` params(id) [auth, db, upload]
- `POST` `/:id/approve` params(id) [auth, db, upload]
- `GET` `/restaurants` params() [db]
- `GET` `/restaurants/:slug/menu` params(slug) [db]
- `GET` `/restaurants/:id/qr` params(id) [auth, db]
