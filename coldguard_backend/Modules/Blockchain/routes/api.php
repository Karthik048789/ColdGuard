<?php

use Illuminate\Support\Facades\Route;
use Modules\Blockchain\App\Http\Controllers\BlockchainController;

Route::middleware(['auth:sanctum'])->prefix('v1')->group(function () {
    Route::apiResource('blockchains', BlockchainController::class)->names('blockchain');
});
