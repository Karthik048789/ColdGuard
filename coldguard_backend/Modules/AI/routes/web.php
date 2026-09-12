<?php

use Illuminate\Support\Facades\Route;
use Modules\AI\App\Http\Controllers\AIController;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::resource('ais', AIController::class)->names('ai');
});
