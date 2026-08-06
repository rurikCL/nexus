<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // damage pasa de smallint a texto libre: admite número plano ("30"), dados ("2d6"),
        // cura explícita ("C10"), bono/penalización al arma ("+5"/"-5") y modificador de
        // fuerza ("+F5"/"-F5"). Los valores negativos existentes (antigua convención de cura)
        // se reescriben como "C{abs}" para conservar su efecto.
        DB::statement("ALTER TABLE rol_habilidades MODIFY damage VARCHAR(20) NOT NULL DEFAULT '0'");

        DB::table('rol_habilidades')
            ->where('damage', 'like', '-%')
            ->get(['id', 'damage'])
            ->each(function ($row) {
                DB::table('rol_habilidades')
                    ->where('id', $row->id)
                    ->update(['damage' => 'C'.abs((int) $row->damage)]);
            });
    }

    public function down(): void
    {
        DB::table('rol_habilidades')
            ->where('damage', 'like', 'C%')
            ->get(['id', 'damage'])
            ->each(function ($row) {
                DB::table('rol_habilidades')
                    ->where('id', $row->id)
                    ->update(['damage' => (string) (-1 * (int) substr($row->damage, 1))]);
            });

        DB::statement('ALTER TABLE rol_habilidades MODIFY damage SMALLINT NOT NULL DEFAULT 0');
    }
};
