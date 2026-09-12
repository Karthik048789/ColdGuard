<?php

use Illuminate\Support\Facades\Route;
use Modules\Shipment\App\Http\Controllers\ShipmentController;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::resource('shipments', ShipmentController::class)->names('shipment');
});
