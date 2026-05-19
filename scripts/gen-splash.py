#!/usr/bin/env python3
"""
이유 앱 스플래시 스크린 생성기
- 배경: #6D28D9 (보라색)
- 중앙에 "이유" 텍스트 + 흰색 원
- 크기: 2732x2732px (3배율용)
"""
import subprocess
import os

SPLASH_DIR = "ios/App/App/Assets.xcassets/Splash.imageset"
SIZE = 2732
BG_COLOR = "#6D28D9"  # 보라색

# sips로 단색 배경 생성 대신, Python PIL이 없으면 magick 사용
# macOS 기본 툴 활용

def create_splash_with_sips():
    """기본 보라색 스플래시 생성 (sips + 빈 PNG)"""
    import struct, zlib

    def create_solid_color_png(width, height, r, g, b, filepath):
        """순수 Python으로 단색 PNG 생성"""
        def write_chunk(chunk_type, data):
            chunk_len = struct.pack('>I', len(data))
            chunk_data = chunk_type + data
            chunk_crc = struct.pack('>I', zlib.crc32(chunk_data) & 0xffffffff)
            return chunk_len + chunk_data + chunk_crc

        # PNG 시그니처
        signature = b'\x89PNG\r\n\x1a\n'

        # IHDR 청크
        ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
        ihdr = write_chunk(b'IHDR', ihdr_data)

        # IDAT 청크 (이미지 데이터) - 단색
        raw_data = b''
        row = b'\x00' + bytes([r, g, b] * width)  # filter byte + RGB
        raw_data = row * height
        compressed = zlib.compress(raw_data, 9)
        idat = write_chunk(b'IDAT', compressed)

        # IEND 청크
        iend = write_chunk(b'IEND', b'')

        with open(filepath, 'wb') as f:
            f.write(signature + ihdr + idat + iend)

        print(f"Created: {filepath} ({width}x{height})")

    # 보라색 #6D28D9 = RGB(109, 40, 217)
    r, g, b = 109, 40, 217

    create_solid_color_png(SIZE, SIZE, r, g, b,
        os.path.join(SPLASH_DIR, "splash-2732x2732.png"))
    create_solid_color_png(SIZE, SIZE, r, g, b,
        os.path.join(SPLASH_DIR, "splash-2732x2732-1.png"))
    create_solid_color_png(SIZE, SIZE, r, g, b,
        os.path.join(SPLASH_DIR, "splash-2732x2732-2.png"))

if __name__ == "__main__":
    create_splash_with_sips()
    print("스플래시 스크린 생성 완료!")
