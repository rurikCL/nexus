<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\ConvertsToWebp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmblemUploadController extends Controller
{
    use ConvertsToWebp;

    public function store(Request $request): JsonResponse
    {
        $request->validate(['emblema' => 'required|image|max:3072']);

        $path = $this->saveAsWebp($request->file('emblema'), 'emblemas');

        return response()->json([
            'path' => $path,
            'url'  => url('storage/' . $path),
        ]);
    }
}
