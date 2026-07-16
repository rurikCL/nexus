<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE pvp_combats MODIFY COLUMN status ENUM('active','pending','declined','cancelled','attacker_won','defender_won','fled_attacker','fled_defender') NOT NULL DEFAULT 'active'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE pvp_combats MODIFY COLUMN status ENUM('active','pending','declined','attacker_won','defender_won','fled_attacker','fled_defender') NOT NULL DEFAULT 'active'");
    }
};
