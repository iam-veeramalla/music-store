package com.musicstore.catalog;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@SpringBootApplication
@RestController
public class CatalogApplication {

    private final JdbcTemplate jdbc;

    public CatalogApplication(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static void main(String[] args) {
        SpringApplication.run(CatalogApplication.class, args);
    }

    @GetMapping("/healthz")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "catalog-service");
    }

    @GetMapping("/products")
    public List<Map<String, Object>> products(@RequestParam(required = false) String category,
                                              @RequestParam(required = false) String q) {
        if (category != null) {
            return jdbc.queryForList("SELECT * FROM products WHERE category = ? ORDER BY id", category);
        }
        if (q != null) {
            return jdbc.queryForList("SELECT * FROM products WHERE LOWER(name) LIKE ? ORDER BY id",
                    "%" + q.toLowerCase() + "%");
        }
        return jdbc.queryForList("SELECT * FROM products ORDER BY id");
    }

    @GetMapping("/products/{id}")
    public Map<String, Object> product(@PathVariable long id) {
        return jdbc.queryForMap("SELECT * FROM products WHERE id = ?", id);
    }

    @GetMapping("/categories")
    public List<Map<String, Object>> categories() {
        return jdbc.queryForList(
                "SELECT category, COUNT(*) AS items FROM products GROUP BY category ORDER BY category");
    }
}
