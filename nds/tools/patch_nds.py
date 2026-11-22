#!/usr/bin/env python3
"""Turn a BlocksDS "DSi enhanced" ROM into a plain Nintendo DS ROM (unit code 0x00) and fix the header CRC.
Usage: patch_nds.py ROM.nds     (patches in place)
Why: DS-mode emulators (DeSmuME/melonDS in DS mode, NDSWeb) handle DSi-flagged homebrew badly; this game needs nothing from the DSi."""
import sys
def crc16(data, crc=0xFFFF):
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if crc & 1 else crc >> 1
    return crc & 0xFFFF
p = sys.argv[1]
d = bytearray(open(p, "rb").read())
print("unit code before: 0x%02X" % d[0x12])
d[0x12] = 0x00
d[0x15E:0x160] = crc16(d[0:0x15E]).to_bytes(2, "little")
open(p, "wb").write(d)
print("patched: unit code 0x00, header crc 0x%04X" % int.from_bytes(d[0x15E:0x160], "little"))
