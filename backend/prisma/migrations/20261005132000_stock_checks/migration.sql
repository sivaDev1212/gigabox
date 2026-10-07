ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_stock_nonnegative" CHECK ("stock" >= 0);
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_threshold_nonnegative" CHECK ("lowStockThreshold" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0);
