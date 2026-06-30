<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RolesSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'administrador', 'label' => 'Administrador', 'description' => 'Acceso completo al panel de administración y configuración del sistema.'],
            ['name' => 'rpg_master',    'label' => 'RPG Master',    'description' => 'Gestión de módulos de rol: mapa galáctico, misiones, NPCs y objetos.'],
            ['name' => 'juez',          'label' => 'Juez',          'description' => 'Puede resolver combates, gestionar temporadas y asignar resultados.'],
            ['name' => 'entrenador',    'label' => 'Entrenador',    'description' => 'Acceso a módulos de entrenamiento y seguimiento de pupilos.'],
        ];

        foreach ($roles as $role) {
            Role::firstOrCreate(['name' => $role['name']], $role);
        }
    }
}
