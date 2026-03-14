export default {
    schema: "./src/schema/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL ??
            "postgres://postgres:123456@localhost:5433/digital_menu",
    },
};
