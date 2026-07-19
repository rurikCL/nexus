<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\ConvertsToWebp;
use App\Models\Character;
use App\Models\Configuracion;
use App\Models\MapEnemigo;
use App\Models\MapLugar;
use App\Models\MapNave;
use App\Models\MapNpc;
use App\Models\MapPlaneta;
use App\Models\MapSistema;
use App\Models\MapZona;
use App\Models\Role;
use App\Models\RolCharacterObjeto;
use App\Models\RolHabilidad;
use App\Models\RolObjeto;
use App\Models\RolSonido;
use App\Models\Sede;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class AdminController extends Controller
{
    use ConvertsToWebp;

    private function model(string $entity): string
    {
        return match ($entity) {
            'sistemas'    => MapSistema::class,
            'planetas'    => MapPlaneta::class,
            'zonas'       => MapZona::class,
            'lugares'     => MapLugar::class,
            'npcs'        => MapNpc::class,
            'enemigos'    => MapEnemigo::class,
            'naves'       => MapNave::class,
            'usuarios'    => User::class,
            'personajes'  => Character::class,
            'roles'       => Role::class,
            'rol_objetos'        => RolObjeto::class,
            'rol_character_objeto' => RolCharacterObjeto::class,
            'rol_habilidades'    => RolHabilidad::class,
            // Alias interno: mismo modelo que 'rol_habilidades', pre-filtrado a tipo=nave.
            // Usado solo por options() para los selectores de habilidad de las naves.
            'rol_habilidades_nave' => RolHabilidad::class,
            'rol_sonidos'        => RolSonido::class,
            'configuraciones'    => Configuracion::class,
            'sedes'       => Sede::class,
            default            => abort(404, "Entidad no reconocida: {$entity}"),
        };
    }

    private function labelField(string $entity): string
    {
        return match ($entity) {
            'usuarios'   => 'name',
            'personajes' => 'name',
            'roles'      => 'label',
            'rol_character_objeto' => 'id',
            default      => 'nombre',
        };
    }

    private function withs(string $entity): array
    {
        return match ($entity) {
            'planetas'   => ['sistema:id,nombre'],
            'zonas'      => ['planeta:id,nombre'],
            'lugares'    => ['zona:id,nombre', 'enemigos'],
            'npcs'       => ['lugar:id,nombre', 'naves', 'objetos'],
            'usuarios'   => ['tutor:id,name', 'roles:id,name,label', 'sede:id,nombre'],
            'personajes' => ['user:id,name,tier,email'],
            'rol_character_objeto' => ['character:id,name,handle', 'rolObjeto:id,nombre'],
            default      => [],
        };
    }

    private function filterableColumns(string $entity): array
    {
        return match ($entity) {
            'rol_habilidades' => ['tipo', 'forma'],
            'rol_objetos'     => ['tipo', 'rareza'],
            default           => [],
        };
    }

    /**
     * Extrae del payload un array tipo [{id, interes}, ...] (o su versión JSON-string,
     * como llega dentro de un FormData) para sincronizar como pivot de venta de un NPC.
     * Devuelve null si la clave no vino en el payload (no tocar el pivot existente).
     */
    private function extractVentaPivot(array &$data, string $key): ?array
    {
        if (!array_key_exists($key, $data)) {
            return null;
        }

        $raw   = $data[$key];
        $items = is_string($raw) ? (json_decode($raw, true) ?? []) : ($raw ?? []);
        unset($data[$key]);

        return collect($items)->mapWithKeys(
            fn($item) => [(int) $item['id'] => ['interes' => (int) ($item['interes'] ?? 0)]]
        )->all();
    }

    /**
     * Extrae del payload un array tipo [{id, tasa_aparicion, nivel}, ...] (o su versión
     * JSON-string) para sincronizar como pivot de enemigos que pueden aparecer en un lugar.
     * Devuelve null si la clave no vino en el payload (no tocar el pivot existente).
     */
    private function extractSpawnPivot(array &$data, string $key): ?array
    {
        if (!array_key_exists($key, $data)) {
            return null;
        }

        $raw   = $data[$key];
        $items = is_string($raw) ? (json_decode($raw, true) ?? []) : ($raw ?? []);
        unset($data[$key]);

        return collect($items)->mapWithKeys(
            fn($item) => [(int) $item['id'] => [
                'tasa_aparicion' => max(1, (int) ($item['tasa_aparicion'] ?? 1)),
                'nivel'          => max(0, (int) ($item['nivel'] ?? 1)),
            ]]
        )->all();
    }

    /** Guarda un archivo subido: las imágenes se convierten a WebP; el resto (ej. audio) se guarda tal cual. */
    private function saveUpload(UploadedFile $file, string $directory): string
    {
        if (str_starts_with((string) $file->getMimeType(), 'image/')) {
            return $this->saveAsWebp($file, $directory);
        }

        Storage::disk('public')->makeDirectory($directory);

        return $file->store($directory, 'public');
    }

    /** Query base de la entidad, con el scope por defecto de los alias internos (p.ej. rol_habilidades_nave). */
    private function baseQuery(string $entity)
    {
        $model = $this->model($entity);
        $query = $model::query();

        if ($entity === 'rol_habilidades_nave') {
            $query->where('tipo', 'nave');
        }

        return $query;
    }

    public function index(Request $request, string $entity): JsonResponse
    {
        $query = $this->baseQuery($entity);

        if ($q = $request->input('q')) {
            $label = $this->labelField($entity);
            $query->where($label, 'like', "%{$q}%");
        }

        foreach ($this->filterableColumns($entity) as $col) {
            if ($request->filled($col)) {
                $query->where($col, $request->input($col));
            }
        }

        if ($withs = $this->withs($entity)) {
            $query->with($withs);
        }

        $perPage = min((int) $request->input('per_page', 25), 100);

        if ($entity === 'rol_habilidades') {
            $query->orderBy('forma')->orderBy('nombre')->orderBy('id');
        } else {
            $query->orderByDesc('id');
        }

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request, string $entity): JsonResponse
    {
        $model = $this->model($entity);
        $data  = $request->all();

        foreach ($request->allFiles() as $key => $file) {
            $data[$key] = $this->saveUpload($file, "admin/{$entity}");
        }

        if ($entity === 'usuarios' && empty($data['password'])) {
            $data['password'] = '1234';
        }

        $roles = null;
        if ($entity === 'usuarios' && array_key_exists('roles', $data)) {
            $roles = $data['roles'];
            unset($data['roles']);
        }

        $naves    = $entity === 'npcs'    ? $this->extractVentaPivot($data, 'naves')      : null;
        $objetos  = $entity === 'npcs'    ? $this->extractVentaPivot($data, 'objetos')    : null;
        $enemigos = $entity === 'lugares' ? $this->extractSpawnPivot($data, 'enemigos')   : null;

        $record = $model::create($data);

        if ($roles !== null && method_exists($record, 'roles')) {
            $record->roles()->sync($roles);
        }
        if ($naves !== null) {
            $record->naves()->sync($naves);
        }
        if ($objetos !== null) {
            $record->objetos()->sync($objetos);
        }
        if ($enemigos !== null) {
            $record->enemigos()->sync($enemigos);
        }

        $fresh = $record->fresh();
        if ($withs = $this->withs($entity)) {
            $fresh->load($withs);
        }
        return response()->json(['record' => $fresh], 201);
    }

    public function update(Request $request, string $entity, int $id): JsonResponse
    {
        $model  = $this->model($entity);
        $record = $model::findOrFail($id);
        $data   = $request->all();

        foreach ($request->allFiles() as $key => $file) {
            if ($record->{$key}) {
                Storage::disk('public')->delete($record->{$key});
            }
            $data[$key] = $this->saveUpload($file, "admin/{$entity}");
        }

        $roles = null;
        if ($entity === 'usuarios' && array_key_exists('roles', $data)) {
            $roles = $data['roles'];
            unset($data['roles']);
        }

        $naves    = $entity === 'npcs'    ? $this->extractVentaPivot($data, 'naves')      : null;
        $objetos  = $entity === 'npcs'    ? $this->extractVentaPivot($data, 'objetos')    : null;
        $enemigos = $entity === 'lugares' ? $this->extractSpawnPivot($data, 'enemigos')   : null;

        $record->update($data);

        if ($roles !== null && method_exists($record, 'roles')) {
            $record->roles()->sync($roles);
        }
        if ($naves !== null) {
            $record->naves()->sync($naves);
        }
        if ($objetos !== null) {
            $record->objetos()->sync($objetos);
        }
        if ($enemigos !== null) {
            $record->enemigos()->sync($enemigos);
        }

        $fresh = $record->fresh();
        if ($withs = $this->withs($entity)) {
            $fresh->load($withs);
        }
        return response()->json(['record' => $fresh]);
    }

    public function destroy(string $entity, int $id): JsonResponse
    {
        if ($entity === 'usuarios') {
            abort(403, 'Los usuarios no se pueden eliminar desde este panel.');
        }

        $model  = $this->model($entity);
        $record = $model::findOrFail($id);
        $record->delete();

        return response()->json(['ok' => true]);
    }

    private function optionExtraFields(string $entity): array
    {
        return match ($entity) {
            'rol_habilidades' => ['forma'],
            default           => [],
        };
    }

    public function options(string $entity): JsonResponse
    {
        $label = $this->labelField($entity);
        $extras = $this->optionExtraFields($entity);

        $select = array_merge(['id', "{$label} as label"], $extras);

        $options = $this->baseQuery($entity)
            ->select($select)
            ->orderBy($label)
            ->get();

        return response()->json(['options' => $options]);
    }

    /** POST /admin/rol_habilidades/{habilidadId}/asignar — desbloquea la habilidad para el personaje indicado
     *  (misma tabla rol_habilidades_aprendidas que usa el jugador al aprenderla normalmente). */
    public function asignarHabilidad(Request $request, int $habilidadId): JsonResponse
    {
        $data = $request->validate([
            'character_id' => 'required|exists:characters,id',
        ]);

        $habilidad = RolHabilidad::findOrFail($habilidadId);
        $character = Character::with('user')->findOrFail($data['character_id']);

        if (!$character->user) {
            return response()->json(['error' => 'Ese personaje no tiene un usuario asociado'], 422);
        }

        $character->user->habilidadesAprendidas()->syncWithoutDetaching([$habilidad->id]);

        return response()->json(['ok' => true]);
    }

    /** POST /admin/rol_objetos/{objetoId}/asignar — agrega el objeto al inventario de uno o más personajes.
     *  Si el personaje ya lo tiene, suma la cantidad al stock existente en vez de duplicar la fila. */
    public function asignarObjeto(Request $request, int $objetoId): JsonResponse
    {
        $data = $request->validate([
            'character_ids'   => 'required|array|min:1',
            'character_ids.*' => 'exists:characters,id',
            'cantidad'        => 'nullable|integer|min:1',
        ]);

        $objeto   = RolObjeto::findOrFail($objetoId);
        $cantidad = $data['cantidad'] ?? 1;

        foreach ($data['character_ids'] as $characterId) {
            $character = Character::find($characterId);
            if (!$character) {
                continue;
            }

            $owned = $character->rolObjetos()->where('rol_objetos.id', $objeto->id)->first();
            if ($owned) {
                $character->rolObjetos()->updateExistingPivot($objeto->id, [
                    'cantidad' => $owned->pivot->cantidad + $cantidad,
                ]);
            } else {
                $character->rolObjetos()->attach($objeto->id, ['cantidad' => $cantidad]);
            }
        }

        return response()->json(['ok' => true, 'count' => count($data['character_ids'])]);
    }
}
