using System.Collections.Concurrent;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// seeded stock per product id
var stock = new ConcurrentDictionary<long, int>(new Dictionary<long, int>
{
    [1] = 14, [2] = 6, [3] = 25, [4] = 2, [5] = 5, [6] = 11, [7] = 6, [8] = 2,
    [9] = 4, [10] = 9, [11] = 7, [12] = 30, [13] = 18, [14] = 3, [15] = 40,
    [16] = 22, [17] = 15, [18] = 8
});

app.MapGet("/healthz", () => Results.Ok(new { status = "ok", service = "inventory-service" }));

app.MapGet("/stock", () =>
    Results.Ok(stock.Select(kv => new { productId = kv.Key, quantity = kv.Value })));

app.MapGet("/stock/{id:long}", (long id) =>
    stock.TryGetValue(id, out var qty)
        ? Results.Ok(new { productId = id, quantity = qty })
        : Results.NotFound(new { error = "unknown product" }));

app.MapPost("/reserve", (ReserveRequest req) =>
{
    if (!stock.TryGetValue(req.ProductId, out var available))
        return Results.NotFound(new { error = "unknown product" });
    if (available < req.Quantity)
        return Results.Conflict(new { error = "insufficient stock", available });
    stock[req.ProductId] = available - req.Quantity;
    return Results.Ok(new { productId = req.ProductId, reserved = req.Quantity, remaining = stock[req.ProductId] });
});

app.MapPost("/restock", (ReserveRequest req) =>
{
    stock.AddOrUpdate(req.ProductId, req.Quantity, (_, cur) => cur + req.Quantity);
    return Results.Ok(new { productId = req.ProductId, quantity = stock[req.ProductId] });
});

app.Run("http://0.0.0.0:8082");

record ReserveRequest(long ProductId, int Quantity);
