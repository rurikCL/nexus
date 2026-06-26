<?php

namespace Database\Seeders;

use App\Models\Character;
use App\Models\Combat;
use App\Models\Event;
use App\Models\Role;
use App\Models\Task;
use App\Models\TrainingDay;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        // ─── Roles ────────────────────────────────────────────────────
        $rolesData = [
            ['name' => 'administrador', 'label' => 'Administrador',  'description' => 'Acceso completo al panel de administración y configuración del sistema.'],
            ['name' => 'rpg_master',    'label' => 'RPG Master',     'description' => 'Gestión de módulos de rol: mapa galáctico, misiones, NPCs y objetos.'],
            ['name' => 'juez',          'label' => 'Juez',           'description' => 'Puede resolver combates, gestionar temporadas y asignar resultados.'],
            ['name' => 'entrenador',    'label' => 'Entrenador',     'description' => 'Acceso a módulos de entrenamiento y seguimiento de pupilos.'],
        ];

        foreach ($rolesData as $rd) {
            Role::firstOrCreate(['name' => $rd['name']], $rd);
        }

        // ─── Users ────────────────────────────────────────────────────
        $usersData = [
            ['name' => 'Valentina Soto',  'email' => 'valentina@nexus.cl'],
            ['name' => 'Carlos Méndez',   'email' => 'carlos@nexus.cl'],
            ['name' => 'María González',  'email' => 'maria@nexus.cl'],
            ['name' => 'Diego Fuentes',   'email' => 'diego@nexus.cl'],
            ['name' => 'Javiera Rojas',   'email' => 'javiera@nexus.cl'],
            ['name' => 'Tomás Bravo',     'email' => 'tomas@nexus.cl'],
            ['name' => 'Ignacia Lillo',   'email' => 'ignacia@nexus.cl'],
            ['name' => 'Felipe Araya',    'email' => 'felipe@nexus.cl'],
        ];

        $users = [];
        foreach ($usersData as $ud) {
            $users[] = User::create([
                'name'     => $ud['name'],
                'email'    => $ud['email'],
                'password' => Hash::make('password'),
            ]);
        }

        [$valentina, $carlos, $maria, $diego, $javiera, $tomas, $ignacia, $felipe] = $users;

        // ─── Characters ───────────────────────────────────────────────
        $charactersData = [
            [
                'user_id' => $valentina->id, 'name' => 'Valentina Soto', 'handle' => 'V-SOTO',
                'cls' => 'vanguardia', 'saber_color' => 'azul', 'wins' => 34, 'losses' => 11,
                'streak' => 4, 'credits' => 4250, 'gold' => true, 'joined_year' => 2024,
                'sector' => 'Sector Andes', 'sponsor' => 'Banco Estado',
                'bio' => 'Cierro distancias antes de que respires. Vanguardia pura.',
                'stats' => ['fuerza' => 78, 'velocidad' => 64, 'tecnica' => 71, 'defensa' => 58, 'foco' => 82],
            ],
            [
                'user_id' => $carlos->id, 'name' => 'Carlos Méndez', 'handle' => 'C-MNDZ',
                'cls' => 'espectro', 'saber_color' => 'verde', 'wins' => 41, 'losses' => 9,
                'streak' => 7, 'credits' => 6120, 'gold' => true,
                'sector' => 'Sector Litoral', 'sponsor' => null, 'joined_year' => null,
                'bio' => 'No me vas a ver venir.',
                'stats' => ['fuerza' => 60, 'velocidad' => 88, 'tecnica' => 84, 'defensa' => 49, 'foco' => 76],
            ],
            [
                'user_id' => $maria->id, 'name' => 'María González', 'handle' => 'M-GNZL',
                'cls' => 'titan', 'saber_color' => 'purpura', 'wins' => 28, 'losses' => 14,
                'streak' => 2, 'credits' => 3380, 'gold' => false,
                'sector' => 'Sector Andes', 'sponsor' => null, 'joined_year' => null,
                'bio' => 'Pasa si puedes.',
                'stats' => ['fuerza' => 85, 'velocidad' => 41, 'tecnica' => 66, 'defensa' => 90, 'foco' => 70],
            ],
            [
                'user_id' => $diego->id, 'name' => 'Diego Fuentes', 'handle' => 'D-FNTS',
                'cls' => 'oraculo', 'saber_color' => 'verde', 'wins' => 52, 'losses' => 6,
                'streak' => 11, 'credits' => 9870, 'gold' => true,
                'sector' => 'Sector Litoral', 'sponsor' => null, 'joined_year' => null,
                'bio' => 'Leo el combate tres turnos antes que tú.',
                'stats' => ['fuerza' => 58, 'velocidad' => 72, 'tecnica' => 91, 'defensa' => 63, 'foco' => 95],
            ],
            [
                'user_id' => $javiera->id, 'name' => 'Javiera Rojas', 'handle' => 'J-ROJS',
                'cls' => 'espectro', 'saber_color' => 'cian', 'wins' => 19, 'losses' => 17,
                'streak' => 0, 'credits' => 1540, 'gold' => false,
                'sector' => 'Sector Sur', 'sponsor' => null, 'joined_year' => null,
                'bio' => 'Subiendo rápido.',
                'stats' => ['fuerza' => 55, 'velocidad' => 79, 'tecnica' => 62, 'defensa' => 51, 'foco' => 68],
            ],
            [
                'user_id' => $tomas->id, 'name' => 'Tomás Bravo', 'handle' => 'T-BRVO',
                'cls' => 'vanguardia', 'saber_color' => 'ambar', 'wins' => 12, 'losses' => 20,
                'streak' => 0, 'credits' => 720, 'gold' => false,
                'sector' => 'Sector Sur', 'sponsor' => null, 'joined_year' => null,
                'bio' => 'Recluta con hambre.',
                'stats' => ['fuerza' => 70, 'velocidad' => 52, 'tecnica' => 48, 'defensa' => 60, 'foco' => 44],
            ],
            [
                'user_id' => $ignacia->id, 'name' => 'Ignacia Lillo', 'handle' => 'I-LILO',
                'cls' => 'oraculo', 'saber_color' => 'azul', 'wins' => 7, 'losses' => 9,
                'streak' => 1, 'credits' => 410, 'gold' => false,
                'sector' => 'Sector Andes', 'sponsor' => null, 'joined_year' => null,
                'bio' => 'Aprendiendo a leer el ring.',
                'stats' => ['fuerza' => 40, 'velocidad' => 58, 'tecnica' => 64, 'defensa' => 47, 'foco' => 72],
            ],
            [
                'user_id' => $felipe->id, 'name' => 'Felipe Araya', 'handle' => 'F-ARYA',
                'cls' => 'titan', 'saber_color' => 'blanco', 'wins' => 3, 'losses' => 6,
                'streak' => 0, 'credits' => 180, 'gold' => false,
                'sector' => 'Sector Litoral', 'sponsor' => null, 'joined_year' => null,
                'bio' => 'Día uno.',
                'stats' => ['fuerza' => 66, 'velocidad' => 38, 'tecnica' => 40, 'defensa' => 71, 'foco' => 50],
            ],
        ];

        foreach ($charactersData as $cd) {
            Character::create($cd);
        }

        // ─── Tutor-Pupil relationships (Diego es tutor de todos los demás) ───
        foreach ([$valentina, $carlos, $maria, $javiera, $tomas, $ignacia, $felipe] as $pupil) {
            $pupil->update(['tutor_id' => $diego->id]);
        }

        // ─── Roles de sistema ─────────────────────────────────────────
        $adminRole = Role::where('name', 'administrador')->first();
        $rpgRole   = Role::where('name', 'rpg_master')->first();
        $juezRole  = Role::where('name', 'juez')->first();

        $diego->roles()->sync([$adminRole->id, $rpgRole->id, $juezRole->id]);

        // ─── Events ───────────────────────────────────────────────────
        $eventsData = [
            [
                'name' => 'Exhibición de Formas · Verano', 'type' => 'EXHIBICIÓN',
                'status' => 'REALIZADO', 'event_date' => '2026-01-10 10:00:00',
                'location' => 'Domo Central', 'reward' => 350, 'reward_badge' => null,
                'capacity' => 30, 'banner' => '#FF6B00',
                'description' => 'Cada combatiente presenta su forma de sable ante la Orden. Recompensa por presentación completada.',
            ],
            [
                'name' => 'Exhibición de Formas · Otoño', 'type' => 'EXHIBICIÓN',
                'status' => 'ABIERTO', 'event_date' => '2026-03-22 10:00:00',
                'location' => 'Domo Central', 'reward' => 400, 'reward_badge' => 'Insignia Exhibición',
                'capacity' => 30, 'banner' => '#FF6B00',
                'description' => 'Presenta tu forma de sable ante un jurado de Maestros. Cupos limitados.',
            ],
            [
                'name' => 'Ceremonia de Ascenso', 'type' => 'CEREMONIA',
                'status' => 'ABIERTO', 'event_date' => '2026-05-15 18:00:00',
                'location' => 'Salón de la Orden', 'reward' => 600, 'reward_badge' => null,
                'capacity' => 80, 'banner' => '#E6B325',
                'description' => 'Reconocimiento de nuevos rangos. Los pupilos destacados presentan su progreso.',
            ],
            [
                'name' => 'Demostración Académica · Andes', 'type' => 'DEMOSTRACIÓN',
                'status' => 'ABIERTO', 'event_date' => '2026-06-27 16:00:00',
                'location' => 'Plaza Andes', 'reward' => 300, 'reward_badge' => null,
                'capacity' => 20, 'banner' => '#38cdf0',
                'description' => 'Demos abiertas al público. Inscríbete para presentar una rutina de 5 minutos.',
            ],
            [
                'name' => 'Taller Abierto: Lectura de Combate', 'type' => 'TALLER',
                'status' => 'PRÓXIMO', 'event_date' => '2026-07-28 15:00:00',
                'location' => 'Sala Táctica', 'reward' => 250, 'reward_badge' => null,
                'capacity' => 16, 'banner' => '#8b5cf6',
                'description' => 'Presenta el análisis de un duelo grabado frente al grupo. Inscripción abre pronto.',
            ],
            [
                'name' => 'Gala Anual NÉXUS', 'type' => 'GALA',
                'status' => 'PRÓXIMO', 'event_date' => '2026-12-12 20:00:00',
                'location' => 'Gran Domo', 'reward' => 1000, 'reward_badge' => 'Medalla de Gala',
                'capacity' => 120, 'banner' => '#E6B325',
                'description' => 'Cierre de temporada. Presentaciones de élite y entrega de reconocimientos.',
            ],
        ];

        $events = [];
        foreach ($eventsData as $ed) {
            $events[] = Event::create($ed);
        }

        [$ev1, $ev2, $ev3, $ev4, $ev5, $ev6] = $events;

        // Event registrations (valentina: ev1 mine, ev3 mine; others)
        $valentina->events()->attach($ev1->id, ['claimed' => false]);
        $valentina->events()->attach($ev3->id, ['claimed' => false]);
        $carlos->events()->attach($ev2->id, ['claimed' => false]);
        $maria->events()->attach($ev3->id, ['claimed' => false]);
        $diego->events()->attach($ev1->id, ['claimed' => false]);
        $diego->events()->attach($ev3->id, ['claimed' => false]);

        // ─── Combats ──────────────────────────────────────────────────
        $combat1 = Combat::create([
            'combatant_a_id' => $diego->id,
            'combatant_b_id' => $carlos->id,
            'odds_a'         => 1.60,
            'odds_b'         => 2.30,
            'scheduled_at'   => now()->setTime(20, 0),
            'event_name'     => 'Copa Orbital · Cuartos',
            'round'          => 'Cuartos · A',
            'live'           => true,
            'resolved'       => false,
        ]);

        $combat2 = Combat::create([
            'combatant_a_id' => $maria->id,
            'combatant_b_id' => $valentina->id,
            'odds_a'         => 2.10,
            'odds_b'         => 1.70,
            'scheduled_at'   => now()->setTime(20, 40),
            'event_name'     => 'Copa Orbital · Cuartos',
            'round'          => 'Cuartos · B',
            'live'           => false,
            'resolved'       => false,
        ]);

        $combat3 = Combat::create([
            'combatant_a_id' => $javiera->id,
            'combatant_b_id' => $tomas->id,
            'odds_a'         => 1.50,
            'odds_b'         => 2.50,
            'scheduled_at'   => now()->addDay()->setTime(18, 30),
            'event_name'     => 'Sparring Abierto',
            'round'          => 'Práctica',
            'live'           => false,
            'resolved'       => false,
        ]);

        $combat4 = Combat::create([
            'combatant_a_id' => $ignacia->id,
            'combatant_b_id' => $felipe->id,
            'odds_a'         => 1.80,
            'odds_b'         => 1.90,
            'scheduled_at'   => now()->addDay()->setTime(19, 10),
            'event_name'     => 'Sparring Abierto',
            'round'          => 'Práctica',
            'live'           => false,
            'resolved'       => false,
        ]);

        // ─── Tasks ────────────────────────────────────────────────────
        Task::create([
            'tutor_id' => $diego->id, 'pupil_id' => $valentina->id,
            'title'    => '3 sesiones de footwork',
            'detail'   => 'Sube velocidad de 64 a 70. Graba cada sesión en bitácora.',
            'due_date' => '2026-06-14', 'progress' => 66, 'status' => 'en-curso', 'reward' => 200,
        ]);
        Task::create([
            'tutor_id' => $diego->id, 'pupil_id' => $valentina->id,
            'title'    => 'Estudiar 2 combates de Méndez',
            'detail'   => 'Identifica su tell antes del crítico.',
            'due_date' => '2026-06-16', 'progress' => 30, 'status' => 'en-curso', 'reward' => 150,
        ]);
        Task::create([
            'tutor_id' => $diego->id, 'pupil_id' => $valentina->id,
            'title'    => 'Acondicionamiento defensivo',
            'detail'   => 'Defensa por debajo de 60. Necesita trabajo.',
            'due_date' => '2026-06-20', 'progress' => 0, 'status' => 'pendiente', 'reward' => 250,
        ]);
        Task::create([
            'tutor_id' => $diego->id, 'pupil_id' => $tomas->id,
            'title'    => 'Fundamentos de guardia',
            'detail'   => 'Mantener guardia alta 5 rounds completos.',
            'due_date' => '2026-06-13', 'progress' => 100, 'status' => 'revision', 'reward' => 120,
        ]);
        Task::create([
            'tutor_id' => $diego->id, 'pupil_id' => $ignacia->id,
            'title'    => 'Lectura de patrones',
            'detail'   => 'Anota patrones de 3 oponentes distintos.',
            'due_date' => '2026-06-17', 'progress' => 45, 'status' => 'en-curso', 'reward' => 180,
        ]);
        Task::create([
            'tutor_id' => $diego->id, 'pupil_id' => $felipe->id,
            'title'    => 'Resistencia base',
            'detail'   => '20 min de circuito sin parar.',
            'due_date' => '2026-06-12', 'progress' => 80, 'status' => 'en-curso', 'reward' => 100,
        ]);

        // ─── Training days (June 2026 for Valentina) ──────────────────
        $trainingLogs = [
            ['date' => '2026-06-02', 'focus' => 'Técnica',   'effort' => 7, 'note' => 'Trabajé combos de entrada. El timing aún me falla contra zurdos.', 'tags' => ['técnica', 'sparring']],
            ['date' => '2026-06-04', 'focus' => 'Cardio',    'effort' => 8, 'note' => 'Circuito completo + 4 rounds de sombra. Las piernas respondieron.', 'tags' => ['cardio']],
            ['date' => '2026-06-06', 'focus' => 'Sparring',  'effort' => 9, 'note' => 'Sparring con María. Me pasó por encima en defensa, confirmado lo que dijo Diego.', 'tags' => ['sparring', 'defensa']],
            ['date' => '2026-06-09', 'focus' => 'Footwork',  'effort' => 6, 'note' => 'Solo footwork. Grabado para la tarea de Diego.', 'tags' => ['técnica']],
            ['date' => '2026-06-10', 'focus' => 'Estudio',   'effort' => 4, 'note' => 'Vi dos combates de Méndez. Su tell: baja el hombro derecho antes del crítico.', 'tags' => ['estudio']],
        ];

        foreach ($trainingLogs as $log) {
            TrainingDay::create(array_merge($log, ['user_id' => $valentina->id]));
        }
    }
}
