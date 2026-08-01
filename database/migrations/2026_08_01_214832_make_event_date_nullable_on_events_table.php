<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * El formulario no obliga a elegir fecha ("Por definir" en la UI si se deja vacío) y el
 * controller ya envía event_date=null en ese caso — pero la columna era NOT NULL, lo que
 * rompía la creación con un error 500 crudo en vez de guardar el evento sin fecha.
 * SQL crudo porque doctrine/dbal (requerido por Blueprint::change()) no está instalado.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE events MODIFY event_date DATETIME NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE events MODIFY event_date DATETIME NOT NULL');
    }
};
