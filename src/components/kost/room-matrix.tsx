"use client";

import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { distinctFloors, type Room, type RoomStatus } from "@/lib/kost-data";
import { SegmentedTabs } from "./segmented-tabs";
import { RoomCard } from "./room-card";

export type TabValue = RoomStatus | "all";

interface RoomMatrixProps {
  rooms: Room[];
  /** Unfiltered count — distinguishes an empty library from an empty filter result */
  totalRooms: number;
  activeTab: TabValue;
  onTabChange: (t: TabValue) => void;
  onSelectRoom: (room: Room) => void;
  onManageRoom: (room: Room) => void;
  onDeleteRoom: (room: Room) => void;
  onCheckinRoom?: (room: Room) => void;
  onAddRoom: () => void;
}

export function RoomMatrix({
  rooms,
  totalRooms,
  activeTab,
  onTabChange,
  onSelectRoom,
  onManageRoom,
  onDeleteRoom,
  onCheckinRoom,
  onAddRoom,
}: RoomMatrixProps) {
  const counts: Record<TabValue, number> = {
    all: rooms.length,
    lunas: rooms.filter((r) => r.status === "lunas").length,
    jatuhTempo: rooms.filter((r) => r.status === "jatuhTempo").length,
    menunggak: rooms.filter((r) => r.status === "menunggak").length,
    kosong: rooms.filter((r) => r.status === "kosong").length,
  };

  const visible = activeTab === "all" ? rooms : rooms.filter((r) => r.status === activeTab);
  const floors = distinctFloors(rooms);

  // Empty library (e.g. after factory reset)
  if (totalRooms === 0) {
    return (
      <section aria-label="Denah kamar" className="space-y-4">
        <SegmentedTabs<TabValue>
          ariaLabel="Filter status kamar"
          value="all"
          onChange={() => {}}
          tabs={[
            { value: "all", label: "Semua", count: 0 },
            { value: "lunas", label: "Lunas", count: 0 },
            { value: "jatuhTempo", label: "Jatuh Tempo", count: 0 },
            { value: "menunggak", label: "Menunggak", count: 0 },
            { value: "kosong", label: "Kosong", count: 0 },
          ]}
        />
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-200 bg-white py-16 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
            <Inbox className="size-5" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[14px] font-bold text-zinc-900">Belum ada kamar</p>
            <p className="mt-1 text-[12.5px] text-zinc-700">
              Klik &lsquo;+ Tambah Kamar&rsquo; untuk memulai — satu per satu atau sekaligus dengan Bulk Add.
            </p>
          </div>
          <Button
            onClick={onAddRoom}
            className="h-9 bg-zinc-900 px-3.5 text-[13px] font-semibold text-white shadow-none hover:bg-zinc-800"
          >
            <Plus className="size-4" strokeWidth={2} />
            Tambah Kamar
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Denah kamar" className="space-y-4">
      {/* Filter tabs — segmented control */}
      <SegmentedTabs<TabValue>
        ariaLabel="Filter status kamar"
        value={activeTab}
        onChange={onTabChange}
        tabs={[
          { value: "all", label: "Semua", count: counts.all },
          { value: "lunas", label: "Lunas", count: counts.lunas },
          { value: "jatuhTempo", label: "Jatuh Tempo", count: counts.jatuhTempo },
          { value: "menunggak", label: "Menunggak", count: counts.menunggak },
          { value: "kosong", label: "Kosong", count: counts.kosong },
        ]}
      />

      {/* Floor sections */}
      {floors.map((floor) => {
        const floorRooms = visible.filter((r) => r.floor === floor);
        if (floorRooms.length === 0) return null;
        const floorTotal = rooms.filter((r) => r.floor === floor).length;
        const floorOccupied = rooms.filter((r) => r.floor === floor && r.status !== "kosong").length;

        return (
          <div key={floor}>
            <div className="mb-2.5 flex items-center gap-2.5">
              <h2 className="text-[13px] font-bold tracking-tight text-zinc-900">Lantai {floor}</h2>
              <span className="inline-flex h-5 items-center rounded-full border border-border bg-white px-2 text-xs font-medium tabular-nums text-zinc-700">
                {floorTotal} Kamar · {floorOccupied} Terisi
              </span>
              {floorRooms.length !== floorTotal && (
                <span className="text-xs tabular-nums text-zinc-700">
                  menampilkan {floorRooms.length}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {floorRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onSelect={onSelectRoom}
                  onManage={onManageRoom}
                  onDelete={onDeleteRoom}
                  onCheckin={onCheckinRoom}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty result */}
      {visible.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 bg-white py-12 text-center">
          <Inbox className="size-5 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-[13px] font-medium text-zinc-700">Tidak ada kamar yang cocok</p>
          <p className="text-xs text-zinc-700">Coba ubah filter status atau kata kunci pencarian.</p>
        </div>
      )}
    </section>
  );
}
