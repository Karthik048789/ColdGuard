<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database with default role users.
     */
    public function run(): void
    {
        // 1. Shipment Manager Account
        User::updateOrCreate(
            ['email' => 'manager@coldguard.ai'],
            [
                'name' => 'Dr. Anjali Sharma (Logistics Manager)',
                'password' => Hash::make('password123'),
                'role' => 'manager',
                'phone' => '+91 9876543210',
            ]
        );

        // 2. Cold-Chain Driver Account
        User::updateOrCreate(
            ['email' => 'driver@coldguard.ai'],
            [
                'name' => 'Rajesh Kumar (Cold-Chain Transport Driver)',
                'password' => Hash::make('password123'),
                'role' => 'driver',
                'phone' => '+91 9876543211',
            ]
        );

        // 3. Healthcare Receiver Account
        User::updateOrCreate(
            ['email' => 'receiver@coldguard.ai'],
            [
                'name' => 'Thrissur District Hospital (Receiver)',
                'password' => Hash::make('password123'),
                'role' => 'receiver',
                'phone' => '+91 9876543212',
            ]
        );

        // Seed Healthcare Demo Shipments
        $this->call(\Modules\Shipment\Database\Seeders\ShipmentDatabaseSeeder::class);
        $this->call(FacilitySeeder::class);

        // Seed predefined receivers (hospital staff who receive cold-chain shipments)
        $this->call(\Modules\Shipment\Database\Seeders\ReceiverSeeder::class);
    }
}
