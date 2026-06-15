<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class EmblemUploadController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate(['emblema' => 'required|image|max:3072']);

        $path = $request->file('emblema')->store('emblemas', 'public');

        return response()->json([
            'path' => $path,
            'url'  => url('storage/' . $path),
        ]);
    }
}
