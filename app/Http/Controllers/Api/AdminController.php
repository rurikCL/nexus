<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\MapLugar;
use App\Models\MapNave;
use App\Models\MapNpc;
use App\Models\MapPlaneta;
use App\Models\MapSistema;
use App\Models\MapZona;
use App\Models\RolCharacterObjeto;
use App\Models\RolObjeto;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    private function model(string $entity): string
    {
        return match ($entity) {
            'sistemas'    => MapSistema::class,
            'planetas'    => MapPlaneta::class,
            'zonas'       => MapZona::class,
            'lugares'     => MapLugar::class,
            'npcs'        => MapNpc::class,
            'naves'       => MapNave::class,
            'usuarios'    => User::class,
            'personajes'  => Character::class,
            'rol_objetos' => RolObjeto::class,
            'rol_character_objeto' => RolCharacterObjeto::class,
            default      => abort(404, "Entidad no reconocida: {$entity}"),
        };
    }

    private function labelField(string $entity): string
    {
        return match ($entity) {
            'usuarios'   => 'name',
            'personajes' => 'name',
            'rol_character_objeto' => 'id',
            default      => 'nombre',
        };
    }

    private function withs(string $entity): array
    {
        return match ($entity) {
            'planetas'   => ['sistema:id,nombre'],
            'zonas'      => ['planeta:id,nombre'],
            'lugares'    => ['zona:id,nombre'],
            'npcs'       => ['lugar:id,nombre'],
            'personajes' => ['user:id,name,tier,email'],
            'rol_character_objeto' => ['character:id,name,handle', 'rolObjeto:id,nombre'],
            default      => [],
        };
    }

    public function index(Request $request, string $entity): JsonResponse
    {
        $model = $this->model($entity);
        $query = $model::query();

        if ($q = $request->input('q')) {
            $label = $this->labelField($entity);
            $query->where($label, 'like', "%{$q}%");
        }

        if ($withs = $this->withs($entity)) {
            $query->with($withs);
        }

        $perPage = min((int) $request->input('per_page', 25), 100);

        return response()->json(
            $query->orderByDesc('id')->paginate($perPage)
        );
    }

    public function store(Request $request, string $entity): JsonResponse
    {
        $model = $this->model($entity);
        $data  = $request->all();

        foreach ($request->allFiles() as $key => $file) {
            $path = $file->store("admin/{$entity}", 'public');
            $data[$key] = $path;
        }

        if ($entity === 'usuarios' && empty($data['password'])) {
            $data['password'] = '1234';
        }

        $record = $model::create($data);

        return response()->json(['record' => $record], 201);
    }

    public function update(Request $request, string $entity, int $id): JsonResponse
    {
        $model  = $this->model($entity);
        $record = $model::findOrFail($id);
        $data   = $request->all();

        foreach ($request->allFiles() as $key => $file) {
            // Borrar anterior si existe
            if ($record->{$key}) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($record->{$key});
            }
            $path = $file->store("admin/{$entity}", 'public');
            $data[$key] = $path;
        }

        $record->update($data);

        return response()->json(['record' => $record->fresh()]);
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

    public function options(string $entity): JsonResponse
    {
        $model = $this->model($entity);
        $label = $this->labelField($entity);

        $options = $model::select('id', "{$label} as label")
            ->orderBy($label)
            ->get();

        return response()->json(['options' => $options]);
    }
}
