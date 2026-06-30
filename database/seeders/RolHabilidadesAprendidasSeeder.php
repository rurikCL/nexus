<?php

namespace Database\Seeders;

use App\Models\RolHabilidad;
use App\Models\User;
use Illuminate\Database\Seeder;

class RolHabilidadesAprendidasSeeder extends Seeder
{
    public function run(): void
    {
        /* Universal habilidades (forma = 0) that everyone gets */
        $universales = RolHabilidad::where('forma', 0)->pluck('id')->toArray();

        User::with('character')->get()->each(function (User $user) use ($universales) {
            if (!$user->character) return;

            $clsRaw = $user->character->cls ?? '';
            preg_match('/(\d+)/', $clsRaw, $m);
            $cls       = isset($m[1]) ? (int) $m[1] : 0;
            $formaHabs = RolHabilidad::where('forma', $cls)->pluck('id')->toArray();
            $toLearn      = array_unique(array_merge($universales, $formaHabs));

            if ($toLearn) {
                $user->habilidadesAprendidas()->syncWithoutDetaching($toLearn);
            }
        });
    }
}
