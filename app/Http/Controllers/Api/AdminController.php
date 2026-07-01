<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\ConvertsToWebp;
use App\Models\Character;
use App\Models\Configuracion;
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
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            'naves'       => MapNave::class,
            'usuarios'    => User::class,
            'personajes'  => Character::class,
            'roles'       => Role::class,
            'rol_objetos'        => RolObjeto::class,
            'rol_character_objeto' => RolCharacterObjeto::class,
            'rol_habilidades'    => RolHabilidad::class,
            'configuraciones'    => Configuracion::class,
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
            'lugares'    => ['zona:id,nombre'],
            'npcs'       => ['lugar:id,nombre'],
            'usuarios'   => ['tutor:id,name', 'roles:id,name,label'],
            'personajes' => ['user:id,name,tier,email'],
            'rol_character_objeto' => ['character:id,name,handle', 'rolObjeto:id,nombre'],
            default      => [],
        };
    }

    private function filterableColumns(string $entity): array
    {
        return match ($entity) {
            'rol_habilidades' => ['tipo', 'forma'],
            default           => [],
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

        foreach ($this->filterableColumns($entity) as $col) {
            if ($request->filled($col)) {
                $query->where($col, $request->input($col));
            }
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
            $data[$key] = $this->saveAsWebp($file, "admin/{$entity}");
        }

        if ($entity === 'usuarios' && empty($data['password'])) {
            $data['password'] = '1234';
        }

        $roles = null;
        if ($entity === 'usuarios' && array_key_exists('roles', $data)) {
            $roles = $data['roles'];
            unset($data['roles']);
        }

        $record = $model::create($data);

        if ($roles !== null && method_exists($record, 'roles')) {
            $record->roles()->sync($roles);
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
                \Illuminate\Support\Facades\Storage::disk('public')->delete($record->{$key});
            }
            $data[$key] = $this->saveAsWebp($file, "admin/{$entity}");
        }

        $roles = null;
        if ($entity === 'usuarios' && array_key_exists('roles', $data)) {
            $roles = $data['roles'];
            unset($data['roles']);
        }

        $record->update($data);

        if ($roles !== null && method_exists($record, 'roles')) {
            $record->roles()->sync($roles);
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
        $model = $this->model($entity);
        $label = $this->labelField($entity);
        $extras = $this->optionExtraFields($entity);

        $select = array_merge(['id', "{$label} as label"], $extras);

        $options = $model::select($select)
            ->orderBy($label)
            ->get();

        return response()->json(['options' => $options]);
    }
}
