<?php

use Illuminate\Support\Facades\Route;
use Modules\Routing\App\Http\Controllers\RoutingController;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::resource('routings', RoutingController::class)->names('routing');
});
