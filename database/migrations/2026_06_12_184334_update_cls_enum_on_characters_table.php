<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Expand enum to include all values, then migrate data, then restrict
        DB::statement("ALTER TABLE characters MODIFY COLUMN cls ENUM('vanguardia','espectro','titan','oraculo','forma1','forma2','forma3','forma4','forma5','forma6','forma7') NOT NULL DEFAULT 'forma1'");
        DB::table('characters')->update(['cls' => 'forma1']);
        DB::statement("ALTER TABLE characters MODIFY COLUMN cls ENUM('forma1','forma2','forma3','forma4','forma5','forma6','forma7') NOT NULL DEFAULT 'forma1'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE characters MODIFY COLUMN cls ENUM('vanguardia','espectro','titan','oraculo','forma1','forma2','forma3','forma4','forma5','forma6','forma7') NOT NULL DEFAULT 'vanguardia'");
        DB::table('characters')->update(['cls' => 'vanguardia']);
        DB::statement("ALTER TABLE characters MODIFY COLUMN cls ENUM('vanguardia','espectro','titan','oraculo') NOT NULL DEFAULT 'vanguardia'");
    }
};
